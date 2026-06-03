/** 소식지 삭제 버튼 노출 — 서버 `assertCanDeleteNewsletterRow` 와 동일 기준 */
export function canDeleteNewsletter(
  user: { id?: string | number | null; role?: string | null } | null | undefined,
  item: { publisherId?: string | null } | null | undefined,
): boolean {
  if (!user || !item) {
    return false
  }
  const role = String(user.role ?? '').trim()
  const isGaDeleteRole = role === 'GA_ADMIN' || role === 'GA_STAFF'
  const isManagerRole = role === 'INSURER_MANAGER' || role === 'LOSS_ADJUSTER'
  const isAuthor = Boolean(
    item.publisherId && String(item.publisherId) === String(user.id ?? ''),
  )
  return isGaDeleteRole || (isManagerRole && isAuthor)
}
