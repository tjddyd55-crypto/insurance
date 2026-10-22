import { isProductionRuntime } from '../../lib/crmUserBulkSmsConfig.js'

/** Dev 전용 플래그. 기본 OFF. 운영에서는 값을 켜도 항상 OFF. */
export const ONEFC_GOOGLE_SYNC_V2_ENV = 'ONEFC_GOOGLE_SYNC_V2'

/**
 * @param {unknown} raw
 */
function isAffirmative(raw) {
  const value = String(raw ?? '').trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

/**
 * Railway development 는 NODE_ENV=production 인 경우가 있어
 * 운영 판정은 isProductionRuntime(RAILWAY_ENVIRONMENT / APP_ENV 우선)을 쓴다.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isOnefcGoogleSyncV2Enabled(env = process.env) {
  if (isProductionRuntime(env)) return false
  return isAffirmative(env[ONEFC_GOOGLE_SYNC_V2_ENV])
}
