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
/** 스토어·Google 검토 계정의 CRM 카카오/SMS 실발송 차단 안내 */
export const STORE_REVIEW_OUTBOUND_BLOCK_MESSAGE =
  '검토용 계정에서는 실제 메시지가 발송되지 않습니다.'

/**
 * 검토용 계정의 카카오·SMS 등 운영 발송 차단 (인증 SMS 등 필수 트랜잭션은 별도 경로).
 * @param {{ username?: string | null, gaCode?: string | null, tenantCode?: string | null }} input
 */
export function isStoreReviewOutboundMessagingBlocked(input) {
  const username = String(input?.username ?? '')
    .trim()
    .toLowerCase()
  if (STORE_REVIEW_USERNAMES.has(username)) {
    return true
  }
  return isStoreReviewBillingSubject(input)
}

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
