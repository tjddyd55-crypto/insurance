/**
 * 소식지 삭제 권한 판정 (서버 SSOT).
 *
 * 기준:
 *  - GA 관리자(SUPER_ADMIN / GA_ADMIN / GA_STAFF) 이거나
 *  - 작성자 본인(payload.publisherId === 현재 사용자 id)
 *
 * GA/tenant 범위(ga_id 일치)는 이 함수가 아니라 호출부의 조회 쿼리 WHERE 절에서
 * 강제한다. 즉 "다른 GA/tenant 의 소식지" 는 애초에 여기까지 도달하지 않는다.
 * 프론트(src/features/insurer-news/utils/newsletterDeletePermission.ts) 는 이
 * 기준을 그대로 미러링하되, 최종 권한 판단은 항상 서버가 한다.
 */

/** GA 범위 소식지를 삭제할 수 있는 관리자 role */
export const GA_ADMIN_NEWSLETTER_ROLES = Object.freeze(['SUPER_ADMIN', 'GA_ADMIN', 'GA_STAFF'])

const GA_ADMIN_ROLE_SET = new Set(GA_ADMIN_NEWSLETTER_ROLES)

/**
 * @param {unknown} role
 * @returns {boolean}
 */
export function isGaAdminNewsletterRole(role) {
  return GA_ADMIN_ROLE_SET.has(String(role ?? '').trim())
}

/**
 * @param {{ userId?: unknown, role?: unknown }} actor 현재 로그인 사용자
 * @param {{ publisherId?: unknown }} newsletter 대상 소식지(작성자 정보)
 * @returns {boolean}
 */
export function canDeleteNewsletter(actor, newsletter) {
  const userId = String(actor?.userId ?? '').trim()
  if (!userId) {
    return false
  }
  if (isGaAdminNewsletterRole(actor?.role)) {
    return true
  }
  const publisherId = String(newsletter?.publisherId ?? '').trim()
  return publisherId.length > 0 && publisherId === userId
}
