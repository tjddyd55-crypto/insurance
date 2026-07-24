/**
 * 게시글 글쓴이 표시 SSOT (프론트).
 * 게시판명은 fallback 에 넣지 않는다.
 */
export type NewsletterPostAuthorLabelInput = {
  organizationName?: string | null
  authorOrganizationName?: string | null
  authorName?: string | null
  displayName?: string | null
  name?: string | null
  loginId?: string | null
  authorDisplayName?: string | null
  legacyAuthorLabel?: string | null
  boardLabel?: string | null
}

export function resolveNewsletterPostAuthorLabel(input: NewsletterPostAuthorLabelInput = {}): string {
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

function trim(value: unknown): string {
  return String(value ?? '').trim()
}
