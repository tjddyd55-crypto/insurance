/**
 * newsletter_boards 관리 API용 SQL — board_scope SSOT.
 */

/** global 게시판 slug 중복 */
export const GLOBAL_NEWSLETTER_BOARD_DUPLICATE_SLUG_SQL = `
  SELECT id
  FROM newsletter_boards
  WHERE slug = $1
    AND is_deleted = false
    AND board_scope = 'global'
  LIMIT 1
`

/** GA 게시판 slug 중복 (동일 GA 내) */
export const GA_NEWSLETTER_BOARD_DUPLICATE_SLUG_SQL = `
  SELECT id
  FROM newsletter_boards
  WHERE slug = $1
    AND is_deleted = false
    AND board_scope = 'ga'
    AND owner_ga_id = $2
  LIMIT 1
`

/** @deprecated GLOBAL_NEWSLETTER_BOARD_DUPLICATE_SLUG_SQL 사용 */
export const NEWSLETTER_BOARD_DUPLICATE_SLUG_SQL = GLOBAL_NEWSLETTER_BOARD_DUPLICATE_SLUG_SQL

/** 사용자 메뉴 — global + 접근 가능한 ga 보드 */
export const NEWSLETTER_BOARDS_VISIBLE_LIST_SQL = `
  SELECT b.*, gc.code AS ga_code, gc.name AS ga_name
  FROM newsletter_boards b
  LEFT JOIN ga_companies gc ON gc.id = b.owner_ga_id
  WHERE b.is_deleted = false
    AND COALESCE(b.is_active, true) = true
    AND b.board_scope IN ('global', 'ga')
    AND (
      b.board_scope = 'global'
      OR (
        b.board_scope = 'ga'
        AND b.owner_ga_id = $1
      )
    )
  ORDER BY
    CASE WHEN b.board_scope = 'global' THEN 0 ELSE 1 END,
    COALESCE(b.sort_order, 0) ASC,
    b.created_at ASC,
    b.label ASC
`

/** slug로 보드 조회 — portal/tenant (safeQuery, $1=slug $2=tenantGaId) */
export const NEWSLETTER_BOARD_BY_SLUG_TENANT_SQL = `
  SELECT b.*, gc.code AS ga_code, gc.name AS ga_name
  FROM newsletter_boards b
  LEFT JOIN ga_companies gc ON gc.id = b.owner_ga_id
  WHERE b.slug = $1
    AND b.is_deleted = false
    AND COALESCE(b.is_active, true) = true
    AND b.board_scope IN ('global', 'ga')
    AND (
      b.board_scope = 'global'
      OR (
        b.board_scope = 'ga'
        AND b.owner_ga_id = $2
      )
    )
  ORDER BY
    CASE WHEN b.board_scope = 'global' THEN 0 ELSE 1 END,
    b.created_at ASC
`

/** slug로 보드 후보 전체 — admin/systemQuery 전용 */
export const NEWSLETTER_BOARD_BY_SLUG_ADMIN_SQL = `
  SELECT b.*, gc.code AS ga_code, gc.name AS ga_name
  FROM newsletter_boards b
  LEFT JOIN ga_companies gc ON gc.id = b.owner_ga_id
  WHERE b.slug = $1
    AND b.is_deleted = false
    AND COALESCE(b.is_active, true) = true
    AND b.board_scope IN ('global', 'ga')
  ORDER BY
    CASE WHEN b.board_scope = 'global' THEN 0 ELSE 1 END,
    b.created_at ASC
`

/** @deprecated NEWSLETTER_BOARD_BY_SLUG_ADMIN_SQL 사용 */
export const NEWSLETTER_BOARD_BY_SLUG_SQL = NEWSLETTER_BOARD_BY_SLUG_ADMIN_SQL

/** @deprecated NEWSLETTER_BOARD_BY_SLUG_TENANT_SQL 사용 */
export const NEWSLETTER_BOARDS_BY_SLUG_SQL = NEWSLETTER_BOARD_BY_SLUG_TENANT_SQL

/** SUPER_ADMIN: global + ga 전체 목록 */
export const SUPER_ADMIN_NEWSLETTER_BOARDS_LIST_SQL = `
  SELECT b.*, gc.code AS ga_code, gc.name AS ga_name
  FROM newsletter_boards b
  LEFT JOIN ga_companies gc ON gc.id = b.owner_ga_id
  WHERE b.is_deleted = false
    AND b.board_scope IN ('global', 'ga')
  ORDER BY
    CASE b.board_scope WHEN 'global' THEN 0 WHEN 'ga' THEN 1 ELSE 2 END,
    COALESCE(b.sort_order, 0) ASC,
    b.created_at ASC,
    b.label ASC
`

/** GA_ADMIN: 자기 GA ga 보드만 */
export const GA_ADMIN_NEWSLETTER_BOARDS_LIST_SQL = `
  SELECT b.*, gc.code AS ga_code, gc.name AS ga_name
  FROM newsletter_boards b
  LEFT JOIN ga_companies gc ON gc.id = b.owner_ga_id
  WHERE b.is_deleted = false
    AND b.board_scope = 'ga'
    AND b.owner_ga_id = $1
  ORDER BY COALESCE(b.sort_order, 0) ASC, b.created_at ASC, b.label ASC
`

export const SUPER_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL = `
  SELECT b.*, gc.code AS ga_code, gc.name AS ga_name
  FROM newsletter_boards b
  LEFT JOIN ga_companies gc ON gc.id = b.owner_ga_id
  WHERE b.id = $1
    AND b.is_deleted = false
    AND b.board_scope IN ('global', 'ga')
  LIMIT 1
`

export const GA_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL = `
  SELECT b.*, gc.code AS ga_code, gc.name AS ga_name
  FROM newsletter_boards b
  LEFT JOIN ga_companies gc ON gc.id = b.owner_ga_id
  WHERE b.id = $1
    AND b.is_deleted = false
    AND b.board_scope = 'ga'
    AND b.owner_ga_id = $2
  LIMIT 1
`

export const SUPER_ADMIN_NEWSLETTER_BOARD_SOFT_DELETE_SQL = `
  UPDATE newsletter_boards
  SET is_deleted = true,
      deleted_at = NOW(),
      updated_at = NOW(),
      is_active = false
  WHERE id = $1
    AND board_scope IN ('global', 'ga')
`

export const GA_ADMIN_NEWSLETTER_BOARD_SOFT_DELETE_SQL = `
  UPDATE newsletter_boards
  SET is_deleted = true,
      deleted_at = NOW(),
      updated_at = NOW(),
      is_active = false
  WHERE id = $1
    AND board_scope = 'ga'
    AND owner_ga_id = $2
`

export const DISABLE_NEWSLETTER_BOARD_SQL = `
  UPDATE newsletter_boards
  SET is_active = false, updated_at = NOW()
  WHERE id = $1
    AND is_deleted = false
  RETURNING *
`

export const INSERT_GLOBAL_NEWSLETTER_BOARD_SQL = `
  INSERT INTO newsletter_boards (
    id, ga_id, slug, label, description, sort_order, is_active,
    is_public, content_scope, board_scope, owner_ga_id, created_by_user_id
  )
  VALUES ($1, NULL, $2, $3, $4, $5, $6, true, 'global', 'global', NULL, $7)
  RETURNING *
`

export const INSERT_GA_NEWSLETTER_BOARD_SQL = `
  INSERT INTO newsletter_boards (
    id, ga_id, slug, label, description, sort_order, is_active,
    is_public, content_scope, board_scope, owner_ga_id, created_by_user_id
  )
  VALUES ($1, NULL, $2, $3, $4, $5, $6, false, 'ga', 'ga', $7, $8)
  RETURNING *
`

/** @deprecated INSERT_GLOBAL_NEWSLETTER_BOARD_SQL / INSERT_GA_NEWSLETTER_BOARD_SQL 사용 */
export const INSERT_NEWSLETTER_BOARD_SQL = INSERT_GLOBAL_NEWSLETTER_BOARD_SQL

export const PATCH_NEWSLETTER_BOARD_SQL = `
  UPDATE newsletter_boards
  SET
    label = COALESCE($2, label),
    description = COALESCE($3, description),
    sort_order = COALESCE($4, sort_order),
    is_active = COALESCE($5, is_active),
    updated_at = NOW()
  WHERE id = $1
    AND is_deleted = false
  RETURNING *
`
