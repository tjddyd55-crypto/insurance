/**
 * newsletter_boards 관리 API용 SQL 빌더.
 * safeQuery는 SQL 본문에 ga_id 문자열이 있어야 하므로 공용/GA 전용 스코프를 명시한다.
 */

/** @param {boolean} isPublic */
export function buildNewsletterBoardDuplicateSlugSql(isPublic) {
  if (isPublic) {
    return {
      sql: `
        SELECT id
        FROM newsletter_boards
        WHERE slug = $1
          AND is_deleted = false
          AND is_public = true
          AND ga_id IS NULL
        LIMIT 1
      `,
      /** @param {string} slug */
      params: (slug) => [slug],
    }
  }
  return {
    sql: `
      SELECT id
      FROM newsletter_boards
      WHERE slug = $1
        AND is_deleted = false
        AND is_public = false
        AND ga_id = $2::int
      LIMIT 1
    `,
    /** @param {string} slug @param {number} gaId */
    params: (slug, gaId) => [slug, gaId],
  }
}

/** SUPER_ADMIN: 게시판 관리 화면에서 공용/GA 게시판 삭제 권한 검증을 위한 전역 조회 */
export const SUPER_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL = `
  SELECT *
  FROM newsletter_boards
  WHERE id = $1
    AND is_deleted = false
  LIMIT 1
`

/** GA 관리자: 자기 GA 전용 게시판만 조회 */
export const GA_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL = `
  SELECT *
  FROM newsletter_boards
  WHERE id = $1
    AND is_deleted = false
    AND is_public = false
    AND ga_id = $2::int
  LIMIT 1
`

/** SUPER_ADMIN: 공용/GA 게시판 소프트 삭제 */
export const SUPER_ADMIN_NEWSLETTER_BOARD_SOFT_DELETE_SQL = `
  UPDATE newsletter_boards
  SET is_deleted = true,
      deleted_at = NOW(),
      updated_at = NOW()
  WHERE id = $1
`

/** GA 관리자: 자기 GA 전용 게시판만 소프트 삭제 */
export const GA_ADMIN_NEWSLETTER_BOARD_SOFT_DELETE_SQL = `
  UPDATE newsletter_boards
  SET is_deleted = true,
      deleted_at = NOW(),
      updated_at = NOW()
  WHERE id = $1
    AND ga_id = $2::int
    AND is_public = false
`

/** SUPER_ADMIN: 소식지 메뉴 관리 목록 — 테넌트 무관 전역 조회 */
export const SUPER_ADMIN_NEWSLETTER_BOARDS_LIST_SQL = `
  SELECT b.*, g.code AS ga_code, g.name AS ga_name
  FROM newsletter_boards b
  LEFT JOIN ga_companies g ON g.id = b.ga_id
  WHERE b.is_deleted = false
  ORDER BY b.is_public DESC, b.created_at ASC, b.label ASC
`
