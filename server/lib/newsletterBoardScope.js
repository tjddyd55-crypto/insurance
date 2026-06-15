/**
 * 동적 소식지 게시판 — 메뉴(전역)와 게시글(content) 스코프 분리 SSOT.
 */

export const CONTENT_SCOPE_GLOBAL = 'global'
export const CONTENT_SCOPE_GA = 'ga'

/** @param {unknown} raw */
export function normalizeContentScope(raw) {
  return String(raw ?? '').trim().toLowerCase() === CONTENT_SCOPE_GLOBAL
    ? CONTENT_SCOPE_GLOBAL
    : CONTENT_SCOPE_GA
}

/** @param {boolean} isPublicLegacy */
export function contentScopeFromLegacyIsPublic(isPublicLegacy) {
  return isPublicLegacy ? CONTENT_SCOPE_GLOBAL : CONTENT_SCOPE_GA
}

/** @param {unknown} scope */
export function isGlobalContentScope(scope) {
  return normalizeContentScope(scope) === CONTENT_SCOPE_GLOBAL
}

/**
 * 게시판 row → API DTO.
 * board/menu 정의는 항상 전역(ga_id IS NULL)이다.
 * @param {Record<string, unknown>} row
 */
export function mapNewsletterBoardDto(row) {
  const contentScope = normalizeContentScope(
    row.content_scope ?? (row.is_public ? CONTENT_SCOPE_GLOBAL : CONTENT_SCOPE_GA),
  )
  return {
    id: String(row.id),
    slug: String(row.slug ?? ''),
    label: String(row.label ?? ''),
    contentScope,
    /** @deprecated contentScope 사용 */
    isPublic: contentScope === CONTENT_SCOPE_GLOBAL,
    gaId: null,
    gaCode: null,
    gaName: null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

/** @param {unknown} v */
function toIso(v) {
  if (v instanceof Date) {
    return v.toISOString()
  }
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString()
  }
  return d.toISOString()
}

/**
 * 동적 게시판 글 목록/상세용 ga_id 필터.
 * @param {{ content_scope?: unknown, contentScope?: unknown, is_public?: boolean }} board
 * @param {number | null | undefined} tenantGaId
 * @param {number} paramIndex — SQL placeholder 시작 번호 ($n)
 */
export function buildDynamicBoardPostGaFilter(board, tenantGaId, paramIndex) {
  if (isGlobalContentScope(board.content_scope ?? board.contentScope ?? board.is_public)) {
    return { sql: 'AND n.ga_id IS NULL', params: [] }
  }
  const gaId = Number(tenantGaId)
  if (!Number.isInteger(gaId) || gaId < 1) {
    return { sql: 'AND FALSE', params: [] }
  }
  return { sql: `AND n.ga_id = $${paramIndex}`, params: [gaId] }
}

/**
 * 게시글 단건 상세용 ga_id 필터 (테이블 alias 없음).
 * @param {{ content_scope?: unknown, contentScope?: unknown, is_public?: boolean }} board
 * @param {number | null | undefined} tenantGaId
 * @param {number} paramIndex
 */
export function buildDynamicBoardPostGaFilterBare(board, tenantGaId, paramIndex) {
  if (isGlobalContentScope(board.content_scope ?? board.contentScope ?? board.is_public)) {
    return { sql: 'AND ga_id IS NULL', params: [] }
  }
  const gaId = Number(tenantGaId)
  if (!Number.isInteger(gaId) || gaId < 1) {
    return { sql: 'AND FALSE', params: [] }
  }
  return { sql: `AND ga_id = $${paramIndex}`, params: [gaId] }
}
