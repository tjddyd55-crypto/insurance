/**
 * newsletter_boards 관리 API용 SQL.
 * 메뉴 정의는 전역(ga_id IS NULL) — safeQuery는 ga_id IS NULL 조건으로 스코프를 명시한다.
 */

/** 전역 메뉴 slug 중복 검사 */
export const NEWSLETTER_BOARD_DUPLICATE_SLUG_SQL = `
  SELECT id
  FROM newsletter_boards
  WHERE slug = $1
    AND is_deleted = false
    AND ga_id IS NULL
  LIMIT 1
`

/** 사용자·관리자 — 활성 전역 메뉴 목록 */
export const NEWSLETTER_BOARDS_VISIBLE_LIST_SQL = `
  SELECT b.*, NULL::text AS ga_code, NULL::text AS ga_name
  FROM newsletter_boards b
  WHERE b.is_deleted = false
    AND b.ga_id IS NULL
  ORDER BY
    CASE WHEN b.content_scope = 'global' THEN 0 ELSE 1 END,
    b.created_at ASC,
    b.label ASC
`

/** slug로 전역 메뉴 조회 */
export const NEWSLETTER_BOARD_BY_SLUG_SQL = `
  SELECT b.*, NULL::text AS ga_code, NULL::text AS ga_name
  FROM newsletter_boards b
  WHERE b.slug = $1
    AND b.is_deleted = false
    AND b.ga_id IS NULL
  LIMIT 1
`

/** SUPER_ADMIN: 소식지 메뉴 관리 목록 — 전역 메뉴 정의 전체 */
export const SUPER_ADMIN_NEWSLETTER_BOARDS_LIST_SQL = `
  SELECT b.*, NULL::text AS ga_code, NULL::text AS ga_name
  FROM newsletter_boards b
  WHERE b.is_deleted = false
    AND b.ga_id IS NULL
  ORDER BY
    CASE WHEN b.content_scope = 'global' THEN 0 ELSE 1 END,
    b.created_at ASC,
    b.label ASC
`

/** SUPER_ADMIN: 게시판 관리 화면에서 메뉴 삭제 권한 검증을 위한 전역 조회 */
export const SUPER_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL = `
  SELECT *
  FROM newsletter_boards
  WHERE id = $1
    AND is_deleted = false
    AND ga_id IS NULL
  LIMIT 1
`

/** GA 관리자: GA별 분리(content_scope=ga) 메뉴만 삭제 가능 */
export const GA_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL = `
  SELECT *
  FROM newsletter_boards
  WHERE id = $1
    AND is_deleted = false
    AND ga_id IS NULL
    AND content_scope = 'ga'
  LIMIT 1
`

export const SUPER_ADMIN_NEWSLETTER_BOARD_SOFT_DELETE_SQL = `
  UPDATE newsletter_boards
  SET is_deleted = true,
      deleted_at = NOW(),
      updated_at = NOW()
  WHERE id = $1
    AND ga_id IS NULL
`

export const GA_ADMIN_NEWSLETTER_BOARD_SOFT_DELETE_SQL = `
  UPDATE newsletter_boards
  SET is_deleted = true,
      deleted_at = NOW(),
      updated_at = NOW()
  WHERE id = $1
    AND ga_id IS NULL
    AND content_scope = 'ga'
`

export const INSERT_NEWSLETTER_BOARD_SQL = `
  INSERT INTO newsletter_boards (
    id, ga_id, slug, label, is_public, content_scope, created_by_user_id
  )
  VALUES ($1, NULL, $2, $3, $4, $5, $6)
  RETURNING *
`
