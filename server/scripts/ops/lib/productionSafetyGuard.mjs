/**
 * Minimal shared guard for operator scripts (readonly + mutation).
 * Reuses dbEnvironmentGuard for DB target classification — no secret output.
 */
import {
  classifyDbTarget,
  isProductionDbTarget,
  logMaskedDbFingerprint,
  parseConnectionMeta,
} from '../../../lib/dbEnvironmentGuard.js'

const PRODUCTION_HOST_HINT =
  /insurance-production|\.up\.railway\.app/i

export function resolveScriptDatabaseUrl(env = process.env, preferKeys = ['DATABASE_URL']) {
  for (const key of preferKeys) {
    const value = String(env[key] ?? '').trim()
    if (value) {
      return { connectionString: value, sourceKey: key }
    }
  }
  return { connectionString: '', sourceKey: null }
}

export function resolveScriptTargetUrl(env = process.env, keys = ['INSURANCE_OPS_TARGET_URL']) {
  for (const key of keys) {
    const value = String(env[key] ?? '').trim()
    if (value) {
      return { targetUrl: value.replace(/\/$/, ''), sourceKey: key }
    }
  }
  return { targetUrl: '', sourceKey: null }
}

export function inferTargetEnvironment({
  env = process.env,
  connectionString = '',
  targetUrl = '',
} = {}) {
  const explicit = String(env.INSURANCE_OPS_TARGET_ENVIRONMENT ?? '').trim().toLowerCase()
  if (explicit === 'production' || explicit === 'development' || explicit === 'local') {
    return explicit
  }
  if (connectionString && isProductionDbTarget(connectionString, env)) {
    return 'production'
  }
  if (targetUrl && PRODUCTION_HOST_HINT.test(targetUrl)) {
    return 'production'
  }
  if (connectionString) {
    const classified = classifyDbTarget(connectionString, env)
    if (classified === 'local') {
      return 'local'
    }
    if (classified.includes('development')) {
      return 'development'
    }
  }
  return explicit || 'unknown'
}

function truthyEnv(env, key) {
  const raw = String(env[key] ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

/**
 * @param {'readonly'|'mutation'} mode
 */
export function assertProductionScriptAccess({
  scriptName,
  mode,
  env = process.env,
  connectionString = '',
  connectionSourceKey = null,
  targetUrl = '',
  targetUrlSourceKey = null,
  entitySummary = null,
  rollbackHint = null,
  requireDatabaseUrl = true,
  mutationOptInEnv = 'INSURANCE_OPS_ALLOW_PRODUCTION_MUTATION',
  dryRunEnv = 'INSURANCE_OPS_DRY_RUN',
} = {}) {
  if (!scriptName || !mode) {
    throw new Error('assertProductionScriptAccess: scriptName and mode are required')
  }

  const targetEnvironment = inferTargetEnvironment({ env, connectionString, targetUrl })
  const mutationOptIn = truthyEnv(env, mutationOptInEnv)
  const dryRun = truthyEnv(env, dryRunEnv)
  const dbMeta = connectionString ? parseConnectionMeta(connectionString) : null

  const banner = {
    phase: 'ops_guard',
    script: scriptName,
    mode,
    mutation: mode === 'mutation',
    readonly: mode === 'readonly',
    targetEnvironment,
    dryRun,
    mutationOptIn,
    database: connectionString
      ? {
          sourceEnv: connectionSourceKey,
          target: classifyDbTarget(connectionString, env),
          host: dbMeta?.hostMasked,
          db: dbMeta?.dbName,
        }
      : null,
    api: targetUrl
      ? {
          sourceEnv: targetUrlSourceKey,
          host: (() => {
            try {
              return new URL(targetUrl).host
            } catch {
              return '(invalid-url)'
            }
          })(),
        }
      : null,
    entitySummary: entitySummary ?? undefined,
    rollbackHint: rollbackHint ?? undefined,
  }

  console.log(JSON.stringify(banner))

  if (requireDatabaseUrl && !connectionString) {
    console.error(
      JSON.stringify({
        phase: 'abort',
        reason: 'database_url_required',
        hint: 'Set DATABASE_URL or CRM_SMS_SMOKE_DATABASE_URL / DATABASE_PUBLIC_URL',
      }),
    )
    process.exit(1)
  }

  if (connectionString) {
    logMaskedDbFingerprint(`[ops-guard] ${scriptName}`, connectionString, env)
  }

  if (mode === 'mutation') {
    if (dryRun) {
      console.log(
        JSON.stringify({
          phase: 'dry_run',
          message: 'Mutation steps skipped — preview/readonly portions may still run.',
        }),
      )
      return { dryRun: true, targetEnvironment, mutationOptIn }
    }

    if (targetEnvironment === 'production' && !mutationOptIn) {
      console.error(
        JSON.stringify({
          phase: 'abort',
          reason: 'production_mutation_blocked',
          requiredEnv: mutationOptInEnv,
          hint:
            'Set explicit production target + mutation opt-in. Run with dry-run first (INSURANCE_OPS_DRY_RUN=true).',
        }),
      )
      process.exit(1)
    }

    if (targetEnvironment === 'unknown') {
      console.error(
        JSON.stringify({
          phase: 'abort',
          reason: 'target_environment_unknown',
          hint: 'Set INSURANCE_OPS_TARGET_ENVIRONMENT=production|development|local',
        }),
      )
      process.exit(1)
    }
  }

  return { dryRun: false, targetEnvironment, mutationOptIn }
}
