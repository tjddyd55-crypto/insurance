/**
 * 동적 소식지 게시판 — board_scope SSOT (system / global / ga).
 * content_scope · is_public 은 하위 호환용.
 */

export const BOARD_SCOPE_SYSTEM = 'system'
export const BOARD_SCOPE_GLOBAL = 'global'
export const BOARD_SCOPE_GA = 'ga'

export const CONTENT_SCOPE_GLOBAL = 'global'
export const CONTENT_SCOPE_GA = 'ga'

/** @param {unknown} raw */
export function normalizeBoardScope(raw) {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === BOARD_SCOPE_SYSTEM || v === BOARD_SCOPE_GLOBAL) return v
  return BOARD_SCOPE_GA
}

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

/** 게시판 slug 정규화 — 생성·조회 공통 */
export function normalizeNewsletterBoardSlug(label) {
  const t = String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
  const stripped = t.replace(/[^\w\u3131-\u318e\uac00-\ud7a3-]/g, '')
  return stripped.slice(0, 64) || 'board'
}

/** @param {unknown} scope */
export function isGlobalContentScope(scope) {
  return normalizeContentScope(scope) === CONTENT_SCOPE_GLOBAL
}

/**
 * @param {Record<string, unknown>} row
 */
export function boardScopeFromBoard(row) {
  if (row.board_scope != null && String(row.board_scope).trim() !== '') {
    return normalizeBoardScope(row.board_scope)
  }
  if (isGlobalContentScope(row.content_scope ?? row.is_public)) {
    return BOARD_SCOPE_GLOBAL
  }
  return BOARD_SCOPE_GA
}

/**
 * @param {Record<string, unknown>} board
 */
export function isGlobalBoardScope(board) {
  return boardScopeFromBoard(board) === BOARD_SCOPE_GLOBAL
}

/**
 * @param {Record<string, unknown>} board
 */
export function isGaBoardScope(board) {
  return boardScopeFromBoard(board) === BOARD_SCOPE_GA
}

/**
 * @param {Record<string, unknown>} board
 */
export function isSystemBoardScope(board) {
  return boardScopeFromBoard(board) === BOARD_SCOPE_SYSTEM
}

/**
 * @param {Record<string, unknown>} board
 * @param {number | null | undefined} tenantGaId
 */
export function canUserAccessBoardMenu(board, tenantGaId) {
  const scope = boardScopeFromBoard(board)
  if (scope === BOARD_SCOPE_GLOBAL) return true
  if (scope === BOARD_SCOPE_SYSTEM) return true
  const ownerGaId = board.owner_ga_id == null ? null : Number(board.owner_ga_id)
  if (!Number.isInteger(ownerGaId) || ownerGaId < 1) {
    return false
  }
  const gaId = Number(tenantGaId)
  return Number.isInteger(gaId) && gaId >= 1 && gaId === ownerGaId
}

/**
 * @param {Record<string, unknown>} row
 */
export function mapNewsletterBoardDto(row) {
  const boardScope = boardScopeFromBoard(row)
  const contentScope =
    boardScope === BOARD_SCOPE_GLOBAL ? CONTENT_SCOPE_GLOBAL : CONTENT_SCOPE_GA
  const ownerGaId = row.owner_ga_id == null ? null : Number(row.owner_ga_id)
  return {
    id: String(row.id),
    slug: String(row.slug ?? ''),
    label: String(row.label ?? ''),
    description: row.description == null ? null : String(row.description),
    boardScope,
    contentScope,
    /** @deprecated boardScope 사용 */
    isPublic: boardScope === BOARD_SCOPE_GLOBAL,
    ownerGaId: Number.isInteger(ownerGaId) && ownerGaId > 0 ? ownerGaId : null,
    gaId: Number.isInteger(ownerGaId) && ownerGaId > 0 ? ownerGaId : null,
    gaCode: row.ga_code == null ? null : String(row.ga_code),
    gaName: row.ga_name == null ? null : String(row.ga_name),
    sortOrder: Number(row.sort_order ?? 0) || 0,
    isActive: row.is_active == null ? true : Boolean(row.is_active),
    systemKey:
      row.system_key == null || String(row.system_key).trim() === ''
        ? null
        : String(row.system_key).trim().toUpperCase(),
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
 * @param {Record<string, unknown>} board
 * @param {number | null | undefined} tenantGaId
 * @param {number} paramIndex
 */
export function resolveBoardPostGaId(board, tenantGaId) {
  if (isGlobalBoardScope(board)) {
    return null
  }
  const ownerGaId = board.owner_ga_id == null ? null : Number(board.owner_ga_id)
  if (Number.isInteger(ownerGaId) && ownerGaId > 0) {
    return ownerGaId
  }
  const gaId = Number(tenantGaId)
  if (!Number.isInteger(gaId) || gaId < 1) {
    return null
  }
  return gaId
}

/**
 * @param {Record<string, unknown>} board
 * @param {number | null | undefined} tenantGaId
 * @param {number} paramIndex
 */
export function buildDynamicBoardPostGaFilter(board, tenantGaId, paramIndex) {
  if (isGlobalBoardScope(board)) {
    return { sql: 'AND n.ga_id IS NULL', params: [] }
  }
  const gaId = resolveBoardPostGaId(board, tenantGaId)
  if (gaId == null) {
    return { sql: 'AND FALSE', params: [] }
  }
  return { sql: `AND n.ga_id = $${paramIndex}`, params: [gaId] }
}

/**
 * @param {Record<string, unknown>} board
 * @param {number | null | undefined} tenantGaId
 * @param {number} paramIndex
 */
export function buildDynamicBoardPostGaFilterBare(board, tenantGaId, paramIndex) {
  const built = buildDynamicBoardPostGaFilter(board, tenantGaId, paramIndex)
  return {
    sql: built.sql.replace(/\bn\./g, ''),
    params: built.params,
  }
}
