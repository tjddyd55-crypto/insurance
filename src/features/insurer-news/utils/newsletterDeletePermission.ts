import type { UserRole } from '../../auth/authApi'
import type { NewsletterItem } from '../types'

/**
 * 소식지 삭제 권한 판정 (프론트).
 *
 * 서버 SSOT(`server/lib/newsletterDeletePermission.js`)를 그대로 미러링한다.
 * 이 함수는 "삭제 버튼 노출 여부" 만 결정하며, 최종 권한 판단은 항상 서버가 한다
 * (버튼 숨김은 UX 편의일 뿐, 보안 경계가 아니다).
 *
 * 기준: GA 관리자(SUPER_ADMIN / GA_ADMIN / GA_STAFF) 이거나 작성자 본인.
 * GA/tenant 범위는 목록 조회 자체가 자기 GA 로 한정되므로 여기서 별도 검사하지 않는다.
 */

const GA_ADMIN_NEWSLETTER_ROLES = new Set<UserRole>(['SUPER_ADMIN', 'GA_ADMIN', 'GA_STAFF'])

export function isGaAdminNewsletterRole(role: UserRole | string | null | undefined): boolean {
  return GA_ADMIN_NEWSLETTER_ROLES.has(String(role ?? '').trim() as UserRole)
}

type NewsletterAuthorLike = Pick<NewsletterItem, 'publisherId'>
type CurrentUserLike = { id?: string | null; role?: UserRole | string | null } | null | undefined

export function canDeleteNewsletter(newsletter: NewsletterAuthorLike, user: CurrentUserLike): boolean {
  const userId = String(user?.id ?? '').trim()
  if (!userId) {
    return false
  }
  if (isGaAdminNewsletterRole(user?.role)) {
    return true
  }
  const publisherId = String(newsletter?.publisherId ?? '').trim()
  return publisherId.length > 0 && publisherId === userId
}
