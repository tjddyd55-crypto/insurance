import {
  RAILWAY_DEVELOPMENT_PUBLIC_DB_HOSTS,
  RAILWAY_PRODUCTION_PUBLIC_DB_HOSTS,
} from '../config/dbEnvironmentTargets.js'

/** 로그용 host 마스킹 (DATABASE_URL 원문 출력 금지) */
export function maskDbHost(hostname) {
  const h = String(hostname ?? '').trim()
  if (!h) {
    return '(unset)'
  }
  if (h.length <= 8) {
    return `${h.slice(0, 2)}***`
  }
  return `${h.slice(0, 4)}***${h.slice(-4)}`
}

export function parseConnectionMeta(connectionString) {
  try {
    const u = new URL(String(connectionString ?? ''))
    return {
      hostMasked: maskDbHost(u.hostname),
      hostname: u.hostname,
      dbName: u.pathname.replace(/^\//, '') || '(default)',
      port: u.port || '5432',
    }
  } catch {
    return { hostMasked: 'invalid', hostname: '', dbName: '?', port: '?' }
  }
}

/**
 * @returns {'production'|'development'|'local'|'railway-production-public-proxy'|'railway-development-public-proxy'|'railway-production-internal'|'railway-development-internal'|'railway-internal-unknown'|'railway-public-proxy-unknown'|'unknown'}
 */
export function classifyDbTarget(connectionString, env = process.env) {
  const explicit = String(env.INSURANCE_DB_ENVIRONMENT ?? '').trim().toLowerCase()
  if (explicit === 'production' || explicit === 'development' || explicit === 'local') {
    return explicit
  }

  const { hostname } = parseConnectionMeta(connectionString)
  if (!hostname) {
    return 'unknown'
  }

  if (/^localhost$|^127\.0\.0\.1$/i.test(hostname)) {
    return 'local'
  }

  if (/^postgres(?:-[a-z0-9]+)?\.railway\.internal$/i.test(hostname)) {
    const railwayEnv = String(env.RAILWAY_ENVIRONMENT ?? env.RAILWAY_ENVIRONMENT_NAME ?? '').toLowerCase()
    if (railwayEnv === 'production') {
      return 'railway-production-internal'
    }
    if (railwayEnv === 'development') {
      return 'railway-development-internal'
    }
    return 'railway-internal-unknown'
  }

  if (RAILWAY_PRODUCTION_PUBLIC_DB_HOSTS.includes(hostname)) {
    return 'railway-production-public-proxy'
  }
  if (RAILWAY_DEVELOPMENT_PUBLIC_DB_HOSTS.includes(hostname)) {
    return 'railway-development-public-proxy'
  }
  if (/\.rlwy\.net$/i.test(hostname)) {
    return 'railway-public-proxy-unknown'
  }

  return 'unknown'
}

export function isProductionDbTarget(connectionString, env = process.env) {
  const target = classifyDbTarget(connectionString, env)
  return (
    target === 'production' ||
    target === 'railway-production-public-proxy' ||
    target === 'railway-production-internal'
  )
}

export function isDevelopmentDbTarget(connectionString, env = process.env) {
  const target = classifyDbTarget(connectionString, env)
  return (
    target === 'development' ||
    target === 'railway-development-public-proxy' ||
    target === 'railway-development-internal'
  )
}

export function logMaskedDbFingerprint(logPrefix, connectionString, env = process.env) {
  const meta = parseConnectionMeta(connectionString)
  const target = classifyDbTarget(connectionString, env)
  console.log(
    `${logPrefix} dbTarget=${target} host=${meta.hostMasked} db=${meta.dbName} port=${meta.port}`,
  )
}

/** 로컬 npm run dev 가 production public proxy 를 보면 경고 (Railway 런타임 제외) */
export function warnIfLocalDevUsesProductionDb(connectionString, env = process.env) {
  const onRailway = Boolean(
    env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID || env.RAILWAY_SERVICE_ID,
  )
  const isLocalProcess = !onRailway && env.NODE_ENV !== 'production'
  if (!isLocalProcess || !connectionString) {
    return
  }

  if (!isProductionDbTarget(connectionString, env)) {
    return
  }

  console.warn('='.repeat(70))
  console.warn('[db-guard] 로컬 서버가 production Postgres public proxy 에 연결되어 있습니다.')
  console.warn('[db-guard] Railway dev UI (https://insurance-dev.up.railway.app) 와 DB 가 다를 수 있습니다.')
  console.warn('[db-guard] development DB public proxy: tramway.proxy.rlwy.net (Railway Postgres → development)')
  console.warn('[db-guard] 자세한 구분: docs/ops/database-environments.md')
  console.warn('='.repeat(70))
}

/**
 * backfill execute · reset 등 mutating 스크립트 진입 가드.
 * execute=false 이면 fingerprint 만 출력.
 */
export function assertSafeForMutatingScript({
  connectionString,
  execute = false,
  scriptName = 'script',
  env = process.env,
  allowProductionExecute = false,
} = {}) {
  if (!connectionString?.trim()) {
    console.error(`[db-guard] ${scriptName}: DATABASE_URL 없음`)
    process.exit(1)
  }

  logMaskedDbFingerprint(`[db-guard] ${scriptName}`, connectionString, env)

  if (!execute) {
    return
  }

  if (isProductionDbTarget(connectionString, env) && !allowProductionExecute) {
    console.error(`[db-guard] ${scriptName}: production DB 대상 execute 차단`)
    console.error('[db-guard] development clone DB 준비 후 INSURANCE_DB_ENVIRONMENT=development 으로 재시도')
    console.error('[db-guard] docs/ops/database-environments.md § dev clone 복구')
    process.exit(1)
  }

  if (isProductionDbTarget(connectionString, env) && allowProductionExecute) {
    console.warn(
      `[db-guard] ${scriptName}: production DB execute 허용 플래그 활성 — 신중히 진행합니다.`,
    )
  }
}
