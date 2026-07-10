/**
 * 기능 요청 작성자/댓글 작성자 표시명.
 * 기본값은 로그인 아이디가 아니라 소속 + 이름이다.
 *
 * @param {{
 *   gaName?: string | null,
 *   tenantName?: string | null,
 *   agencyName?: string | null,
 *   userName?: string | null,
 *   displayName?: string | null,
 *   name?: string | null,
 *   loginId?: string | null,
 *   username?: string | null,
 * }} row
 * @returns {string}
 */
export function formatFeatureRequestAuthor(row) {
  const gaName = String(row?.gaName || row?.tenantName || row?.agencyName || '').trim()
  const userName = String(row?.userName || row?.displayName || row?.name || '').trim()
  const loginId = String(row?.loginId || row?.username || '').trim()

  if (gaName && userName) {
    return `${gaName} / ${userName}`
  }
  if (gaName && loginId) {
    return `${gaName} / ${loginId}`
  }
  if (userName) {
    return userName
  }
  return loginId || '—'
}

/**
 * @param {{
 *   authorRole?: string | null,
 *   authorGaName?: string | null,
 *   authorDisplayName?: string | null,
 *   authorUsername?: string | null,
 *   authorId?: string | null,
 * }} comment
 * @returns {string}
 */
export function formatFeatureRequestCommentAuthor(comment) {
  const roleLabel = comment?.authorRole === 'admin' ? '담당자' : '요청자'
  const display = formatFeatureRequestAuthor({
    gaName: comment?.authorGaName,
    userName: comment?.authorDisplayName,
    username: comment?.authorUsername,
    loginId: comment?.authorId,
  })
  return `${roleLabel} · ${display}`
}
