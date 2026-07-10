/** 기능 요청 댓글 — safeQuery GA scope 필수 SQL (단일 진실 원천)
 *
 * production 레거시 스키마:
 *   - request_id NOT NULL  (레거시 FK)
 *   - author_id NOT NULL  (레거시 작성자)
 * 신규 스키마 컬럼:
 *   - feature_request_id, author_user_id, author_username, ga_id
 *
 * INSERT/SELECT 는 레거시·신규 컬럼을 모두 채우거나 함께 조회한다.
 */

/** 요청 id 매칭 — request_id / feature_request_id 병행 */
export const FEATURE_REQUEST_COMMENT_REQUEST_MATCH_SQL = `
  (
    c.request_id = $1
    OR c.feature_request_id = $1
  )
`

export const FEATURE_REQUEST_COMMENT_SELECT_SQL = `
  SELECT
    c.id,
    COALESCE(c.feature_request_id, c.request_id) AS feature_request_id,
    COALESCE(c.author_user_id, c.author_id) AS author_user_id,
    c.author_role,
    c.author_username,
    c.content,
    c.created_at,
    COALESCE(
      NULLIF(TRIM(u.display_name), ''),
      NULLIF(TRIM(u.name), ''),
      NULLIF(TRIM(c.author_username), ''),
      NULLIF(TRIM(u.username), ''),
      ''
    ) AS author_display_name,
    COALESCE(NULLIF(TRIM(ag.name), ''), NULLIF(TRIM(rg.name), ''), '') AS author_ga_name
  FROM feature_request_comments c
  LEFT JOIN users u ON u.id = COALESCE(c.author_user_id, c.author_id)
  LEFT JOIN ga_companies ag ON ag.id = u.ga_id
  LEFT JOIN ga_companies rg ON rg.id = c.ga_id
  WHERE (
      c.request_id = $1
      OR c.feature_request_id = $1
    )
    AND c.ga_id = $2
  ORDER BY c.created_at ASC, c.id ASC
  LIMIT 500
`

/**
 * INSERT — production NOT NULL(request_id, author_id) + 신규 컬럼 동시 채움
 * $1 request id, $2 author_user_id, $3 author_username, $4 content, $5 request ga_id
 */
export const FEATURE_REQUEST_COMMENT_INSERT_SQL = `
  INSERT INTO feature_request_comments
    (
      request_id,
      feature_request_id,
      ga_id,
      author_id,
      author_user_id,
      author_role,
      author_username,
      content
    )
  SELECT
    r.id,
    r.id,
    r.ga_id,
    $2,
    $2,
    'admin',
    $3,
    $4
  FROM feature_requests r
  WHERE r.id = $1
    AND r.ga_id = $5
  RETURNING
    id,
    COALESCE(feature_request_id, request_id) AS feature_request_id,
    COALESCE(author_user_id, author_id) AS author_user_id,
    author_role,
    author_username,
    content,
    created_at
`

export const FEATURE_REQUEST_COMMENT_COUNT_SUBQUERY_SQL = `
  SELECT COUNT(*)
  FROM feature_request_comments c
  WHERE (
      c.request_id = fr.id
      OR c.feature_request_id = fr.id
    )
    AND c.ga_id = fr.ga_id
`
