import {
  assertSafeForMutatingScript,
  classifyDbTarget,
  isDevelopmentDbTarget,
  isProductionDbTarget,
  logMaskedDbFingerprint,
} from '../../lib/dbEnvironmentGuard.js'

/**
 * @param {{ scriptName: string, execute: boolean, env?: object }} opts
 */
export function assertDevelopmentDatabaseOnly(opts) {
  const env = opts.env ?? process.env
  const connectionString = String(env.DATABASE_URL ?? '').trim()
  const scriptName = opts.scriptName ?? 'dev-script'

  assertSafeForMutatingScript({
    connectionString,
    execute: opts.execute,
    scriptName,
    env,
  })

  if (isProductionDbTarget(connectionString, env)) {
    console.error(`[${scriptName}] production DB — abort`)
    process.exit(1)
  }

  const explicitDev = String(env.INSURANCE_DB_ENVIRONMENT ?? '').toLowerCase() === 'development'
  const classifiedDev = isDevelopmentDbTarget(connectionString, env)
  const railwayDev = String(env.RAILWAY_ENVIRONMENT ?? '').toLowerCase() === 'development'

  if (!explicitDev && !classifiedDev && !railwayDev) {
    console.error(`[${scriptName}] development DB not confirmed — set INSURANCE_DB_ENVIRONMENT=development`)
    process.exit(1)
  }

  logMaskedDbFingerprint(`[${scriptName}]`, connectionString, env)
  console.log(
    JSON.stringify({
      DEV_DATABASE_CONFIRMED: true,
      dbTarget: classifyDbTarget(connectionString, env),
      railwayEnvironment: env.RAILWAY_ENVIRONMENT ?? null,
      insuranceDbEnvironment: env.INSURANCE_DB_ENVIRONMENT ?? null,
    }),
  )

  return { connectionString, env }
}
