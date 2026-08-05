/**
 * 결제 UI 노출 정책 — free-launch 숨김 + store review tenant 예외.
 * 서버 `server/lib/storeReviewIdentity.js` 와 동일 문자열·판정 규칙을 유지한다.
 */

import { isFreeLaunchBillingUiHidden } from './freeLaunchPolicy'

export const STORE_REVIEW_GA_CODE = 'PLAY_REVIEW'
export const STORE_REVIEW_TENANT_CODE = 'play_review'

export const STORE_REVIEW_USERNAMES = new Set(['google_review', 'apple_review'])

export type StoreReviewBillingSubjectInput = {
  gaCode?: string | null
  tenantCode?: string | null
  username?: string | null
}

export function isStoreReviewBillingSubject(input: StoreReviewBillingSubjectInput | null | undefined): boolean {
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

  const username = String(input?.username ?? '')
    .trim()
    .toLowerCase()
  if (STORE_REVIEW_USERNAMES.has(username) && gaCode === '') {
    return true
  }

  return false
}

/**
 * PG 심사 종료 후 `VITE_BILLING_REVIEW_ACCESS_ENABLED=false` 로 끌 수 있다.
 * 기본 true (미설정 = 허용).
 */
export function isBillingReviewAccessEnabled(): boolean {
  const raw = String(import.meta.env.VITE_BILLING_REVIEW_ACCESS_ENABLED ?? 'true')
    .trim()
    .toLowerCase()
  if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') {
    return false
  }
  return true
}

/**
 * 결제 라우트·메뉴·프로필 섹션 표시 여부.
 * - 일반: free-launch 숨김이 꺼져 있으면 표시
 * - review tenant: free-launch 중이어도 표시 (플래그로 끌 수 있음)
 */
export function isBillingUiVisibleForUser(
  user: StoreReviewBillingSubjectInput | null | undefined,
): boolean {
  if (isBillingReviewAccessEnabled() && isStoreReviewBillingSubject(user)) {
    return true
  }
  return !isFreeLaunchBillingUiHidden()
}

export function isBillingUiHiddenForUser(
  user: StoreReviewBillingSubjectInput | null | undefined,
): boolean {
  return !isBillingUiVisibleForUser(user)
}

/** checkout 에서 review 는 장기 구독이어도 결제 요청 CTA 유지 (entitlement 만료 금지) */
export function canReviewTenantStartCheckoutPayment(
  user: StoreReviewBillingSubjectInput | null | undefined,
): boolean {
  return isBillingReviewAccessEnabled() && isStoreReviewBillingSubject(user)
}
