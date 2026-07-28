function normalizeBooleanEnv(raw) {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
  return s === '1' || s === 'TRUE' || s === 'YES' || s === 'Y' || s === 'ON' || s === 'T'
}

function isProductionRuntime() {
  const nodeEnv = String(process.env.NODE_ENV ?? '').trim().toLowerCase()
  if (nodeEnv === 'production') return true
  if (String(process.env.RAILWAY_ENVIRONMENT ?? '').trim()) return true
  const appEnv = String(process.env.APP_ENV ?? '').trim().toLowerCase()
  return appEnv === 'production'
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
