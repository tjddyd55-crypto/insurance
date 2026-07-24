/**
 * 게시글 글쓴이 표시 SSOT.
 * 게시판명(board.label)은 fallback 에 포함하지 않는다.
 *
 * @param {{
 *   organizationName?: unknown,
 *   authorOrganizationName?: unknown,
 *   authorName?: unknown,
 *   displayName?: unknown,
 *   name?: unknown,
 *   loginId?: unknown,
 *   authorDisplayName?: unknown,
 *   legacyAuthorLabel?: unknown,
 *   boardLabel?: unknown,
 * }} input
 * @returns {string}
 */
export function resolveNewsletterPostAuthorLabel(input = {}) {
  const boardLabel = trim(input.boardLabel)
  const authorDisplayName = trim(input.authorDisplayName)
  if (authorDisplayName && authorDisplayName !== boardLabel) {
    return authorDisplayName
  }

  const organizationName = trim(input.organizationName ?? input.authorOrganizationName)
  const authorName = trim(input.authorName ?? input.displayName ?? input.name)
  if (organizationName && authorName) {
    return `${organizationName} · ${authorName}`
  }
  if (authorName) {
    return authorName
  }

  const displayName = trim(input.displayName)
  if (displayName && displayName !== boardLabel) {
    return displayName
  }

  const loginId = trim(input.loginId)
  if (loginId) {
    return loginId
  }

  const legacy = trim(input.legacyAuthorLabel)
  if (legacy && legacy !== boardLabel) {
    return legacy
  }

  return '—'
}

/**
 * 작성자 계정 row/DTO 로부터 payload 에 넣을 작성자 스냅샷 필드를 만든다.
 * @param {{
 *   id?: unknown,
 *   name?: unknown,
 *   organizationName?: unknown,
 *   organization_name?: unknown,
 *   loginId?: unknown,
 *   login_id?: unknown,
 * } | null | undefined} writer
 * @param {string} [boardLabel]
 */
export function buildNewsletterAuthorSnapshotFromWriter(writer, boardLabel = '') {
  if (!writer || typeof writer !== 'object') {
    return {
      authorAccountId: '',
      authorName: '',
      authorOrganizationName: '',
      authorDisplayName: '—',
      loginId: '',
    }
  }
  const authorName = trim(writer.name) || trim(writer.loginId ?? writer.login_id)
  const authorOrganizationName = trim(writer.organizationName ?? writer.organization_name)
  const loginId = trim(writer.loginId ?? writer.login_id)
  const authorDisplayName = resolveNewsletterPostAuthorLabel({
    organizationName: authorOrganizationName,
    authorName,
    loginId,
    boardLabel,
  })
  return {
    authorAccountId: trim(writer.id),
    authorName: trim(writer.name) || authorName,
    authorOrganizationName,
    authorDisplayName,
    loginId,
  }
}

/**
 * 목록/상세 mapper 용 — payload + writer join 컬럼으로 표시명 결정.
 * @param {{
 *   payload?: Record<string, unknown> | null,
 *   companyNameSnapshot?: unknown,
 *   writerName?: unknown,
 *   writerOrganizationName?: unknown,
 *   writerLoginId?: unknown,
 *   boardLabel?: unknown,
 * }} input
 */
export function resolveNewsletterRowAuthorDisplay(input = {}) {
  const payload = input.payload && typeof input.payload === 'object' ? input.payload : {}
  const boardLabel = trim(input.boardLabel ?? payload.boardLabel)
  const hasWriterJoin =
    Boolean(trim(input.writerName)) ||
    Boolean(trim(input.writerOrganizationName)) ||
    Boolean(trim(input.writerLoginId))
  const isBoardWriterPost =
    Boolean(trim(payload.dynamicBoardSlug)) ||
    String(payload.insurerCode ?? '').trim().toUpperCase() === 'BOARD' ||
    String(payload.newsChannel ?? '').trim().toUpperCase() === 'BOARD' ||
    Boolean(trim(payload.newsletterBoardId)) ||
    Boolean(trim(payload.authorAccountId)) ||
    Boolean(trim(payload.authorName)) ||
    Boolean(trim(payload.authorDisplayName)) ||
    Boolean(trim(payload.authorOrganizationName)) ||
    (hasWriterJoin &&
      (String(payload.newsChannel ?? '').trim().toUpperCase() === 'LOSS_ADJUSTER' ||
        String(payload.insurerCode ?? '').trim().toUpperCase() === 'LOSS_ADJUSTER'))

  if (!isBoardWriterPost) {
    return {
      boardLabel,
      authorName: '',
      authorOrganizationName: '',
      authorDisplayName: trim(payload.insurerName ?? input.companyNameSnapshot) || '—',
      insurerName: trim(payload.insurerName ?? input.companyNameSnapshot) || '—',
    }
  }

  const authorName =
    trim(payload.authorName) || trim(input.writerName) || trim(payload.displayName)
  const authorOrganizationName =
    trim(payload.authorOrganizationName) || trim(input.writerOrganizationName)
  const authorDisplayName = resolveNewsletterPostAuthorLabel({
    authorDisplayName: payload.authorDisplayName,
    organizationName: authorOrganizationName,
    authorName,
    displayName: payload.authorName ?? input.writerName,
    loginId: input.writerLoginId ?? payload.loginId,
    legacyAuthorLabel: payload.insurerName ?? input.companyNameSnapshot,
    boardLabel,
  })

  return {
    boardLabel,
    authorName: authorName || (authorDisplayName === '—' ? '' : authorDisplayName),
    authorOrganizationName,
    authorDisplayName,
    insurerName: authorDisplayName,
  }
}

function trim(value) {
  return String(value ?? '').trim()
}
