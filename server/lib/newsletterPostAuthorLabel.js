/**
 * 앱/공개 API 게시자(회사·소속) 표시 SSOT.
 * 개인 작성자명·로그인 ID 는 사용하지 않는다.
 *
 * @param {{
 *   organizationName?: unknown,
 *   authorOrganizationName?: unknown,
 *   authorDisplayName?: unknown,
 *   authorName?: unknown,
 *   loginId?: unknown,
 *   legacyAuthorLabel?: unknown,
 *   insurerName?: unknown,
 *   boardLabel?: unknown,
 * }} input
 * @returns {string}
 */
export function resolveNewsletterPublisherName(input = {}) {
  const boardLabel = trim(input.boardLabel)
  const organizationName = trim(input.organizationName ?? input.authorOrganizationName)
  if (organizationName) {
    return organizationName
  }

  const legacy = trim(input.legacyAuthorLabel ?? input.insurerName)
  if (legacy && legacy !== boardLabel) {
    return legacy
  }

  const authorDisplayName = trim(input.authorDisplayName)
  if (authorDisplayName && authorDisplayName !== boardLabel) {
    if (authorDisplayName.includes(' · ')) {
      const orgPart = trim(authorDisplayName.split(' · ')[0])
      if (orgPart) {
        return orgPart
      }
    }
    if (!trim(input.authorName) && !trim(input.loginId)) {
      return authorDisplayName
    }
  }

  return '—'
}

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
  const authorDisplayName = resolveNewsletterPublisherName({
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
    const publisherName = resolveNewsletterPublisherName({
      legacyAuthorLabel: payload.insurerName ?? input.companyNameSnapshot,
      insurerName: payload.insurerName ?? input.companyNameSnapshot,
      boardLabel,
    })
    return {
      boardLabel,
      authorName: '',
      authorOrganizationName: '',
      authorDisplayName: publisherName,
      insurerName: publisherName,
      publisherName,
    }
  }

  const authorName =
    trim(payload.authorName) || trim(input.writerName) || trim(payload.displayName)
  const authorOrganizationName =
    trim(payload.authorOrganizationName) || trim(input.writerOrganizationName)
  const publisherName = resolveNewsletterPublisherName({
    authorDisplayName: payload.authorDisplayName,
    organizationName: authorOrganizationName,
    authorName,
    loginId: input.writerLoginId ?? payload.loginId,
    legacyAuthorLabel: payload.insurerName ?? input.companyNameSnapshot,
    boardLabel,
  })

  return {
    boardLabel,
    authorName: authorName || '',
    authorOrganizationName,
    authorDisplayName: publisherName,
    insurerName: publisherName,
    publisherName,
  }
}

function trim(value) {
  return String(value ?? '').trim()
}
