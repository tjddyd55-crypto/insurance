function normalizeBooleanEnv(raw) {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
  return s === '1' || s === 'TRUE' || s === 'YES' || s === 'Y' || s === 'ON' || s === 'T'
}

/**
 * Railway develop 도 NODE_ENV=production 인 경우가 많아,
 * RAILWAY_ENVIRONMENT / APP_ENV 를 우선한다.
 * (아무 Railway env 값이나 production 으로 오판하지 않음)
 */
export function isProductionRuntime(env = process.env) {
  const railwayEnv = String(env.RAILWAY_ENVIRONMENT ?? '').trim().toLowerCase()
  if (railwayEnv === 'production' || railwayEnv === 'prod') return true
  if (
    railwayEnv === 'development' ||
    railwayEnv === 'dev' ||
    railwayEnv === 'staging' ||
    railwayEnv === 'preview'
  ) {
    return false
  }

  const appEnv = String(env.APP_ENV ?? '').trim().toLowerCase()
  if (appEnv === 'production' || appEnv === 'prod') return true
  if (appEnv === 'development' || appEnv === 'dev' || appEnv === 'staging') return false

  const nodeEnv = String(env.NODE_ENV ?? '').trim().toLowerCase()
  return nodeEnv === 'production'
}

/** Feature gate — 기본 true (API 노출). false 면 403. */
export function isCrmUserBulkSmsEnabled() {
  const raw = process.env.SUPER_ADMIN_USER_BULK_SMS_ENABLED
  if (raw == null || String(raw).trim() === '') return true
  return normalizeBooleanEnv(raw)
}

/** 실발송 허용 — 기본 false (dry-run). 인증 SMS 플래그와 무관. */
export function isCrmUserBulkSmsRealSendEnabled() {
  return normalizeBooleanEnv(process.env.SUPER_ADMIN_USER_BULK_SMS_REAL_SEND_ENABLED)
}

export function getCrmUserBulkSmsMaxRecipients() {
  const n = Number(process.env.SUPER_ADMIN_USER_BULK_SMS_MAX_RECIPIENTS ?? 500)
  if (!Number.isFinite(n) || n < 1) return 500
  return Math.min(Math.floor(n), 5000)
}

/** @returns {Set<string>} digits-only allowlist */
export function getCrmUserBulkSmsDevAllowlist() {
  const raw = String(process.env.SUPER_ADMIN_USER_BULK_SMS_DEV_ALLOWLIST ?? '').trim()
  if (!raw) return new Set()
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((v) => v.replace(/\D/g, ''))
      .filter(Boolean),
  )
}

export function getCrmUserBulkSmsDefaultSender() {
  return String(process.env.SUPER_ADMIN_USER_BULK_SMS_DEFAULT_SENDER ?? '')
    .replace(/\D/g, '')
    .trim()
}

export function getCrmUserBulkSmsRuntimeInfo() {
  return {
    enabled: isCrmUserBulkSmsEnabled(),
    realSendEnabled: isCrmUserBulkSmsRealSendEnabled(),
    maxRecipients: getCrmUserBulkSmsMaxRecipients(),
    defaultSender: getCrmUserBulkSmsDefaultSender() || null,
    productionRuntime: isProductionRuntime(),
    allowlistCount: getCrmUserBulkSmsDevAllowlist().size,
    audienceType: 'CRM_USER',
    sourceType: 'SUPER_ADMIN_BULK_NOTICE',
  }
}
