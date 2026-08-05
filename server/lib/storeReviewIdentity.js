/**
 * App Store / Play Console / PG 심사용 테넌트·계정 SSOT.
 * 숫자 ga_id·tenant_id 하드코딩 금지 — code/slug/username 프로필만 사용.
 */

export const STORE_REVIEW_GA_CODE = 'PLAY_REVIEW'
export const STORE_REVIEW_TENANT_CODE = 'play_review'

/** @type {ReadonlySet<string>} */
export const STORE_REVIEW_USERNAMES = new Set(['google_review', 'apple_review'])

/**
 * @param {{
 *   gaCode?: string | null
 *   tenantCode?: string | null
 *   username?: string | null
 * }} input
 */
export function isStoreReviewBillingSubject(input) {
  const gaCode = String(input?.gaCode ?? '')
    .trim()
    .toUpperCase()
  if (gaCode === STORE_REVIEW_GA_CODE) {
    return true
  }

  const tenantCode = String(input?.tenantCode ?? '')
    .trim()
    .toLowerCase()
  if (tenantCode === STORE_REVIEW_TENANT_CODE) {
    return true
  }

  // 구세션에 gaCode 가 비어 있을 때만 username 폴백 (단독 username 스푸핑 완화)
  const username = String(input?.username ?? '')
    .trim()
    .toLowerCase()
  if (STORE_REVIEW_USERNAMES.has(username) && gaCode === '') {
    return true
  }

  return false
}

/**
 * PG 심사용 결제 UI 예외 허용. false 로 끄면 review tenant 도 free-launch 숨김을 따른다.
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function isBillingReviewAccessEnabled(env = process.env) {
  const raw = String(env.BILLING_REVIEW_ACCESS_ENABLED ?? 'true').trim().toLowerCase()
  if (raw === '' || raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on') {
    return true
  }
  if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') {
    return false
  }
  return true
}
