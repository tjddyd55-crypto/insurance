/** 기능 요청 댓글 — safeQuery GA scope 필수 SQL (단일 진실 원천) */

export const FEATURE_REQUEST_COMMENT_SELECT_SQL = `
  SELECT
    c.id,
    c.feature_request_id,
    c.author_user_id,
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
  LEFT JOIN users u ON u.id = c.author_user_id
  LEFT JOIN ga_companies ag ON ag.id = u.ga_id
  LEFT JOIN ga_companies rg ON rg.id = c.ga_id
  WHERE c.feature_request_id = $1
    AND c.ga_id = $2
  ORDER BY c.created_at ASC, c.id ASC
  LIMIT 500
`

/**
 * INSERT 는 부모 feature_requests 의 ga_id 를 그대로 사용한다.
 * $1 request id, $2 author_user_id, $3 author_username, $4 content, $5 request ga_id
 */
export const FEATURE_REQUEST_COMMENT_INSERT_SQL = `
  INSERT INTO feature_request_comments
    (feature_request_id, ga_id, author_user_id, author_role, author_username, content)
  SELECT
    r.id,
    r.ga_id,
    $2,
    'admin',
    $3,
    $4
  FROM feature_requests r
  WHERE r.id = $1
    AND r.ga_id = $5
  RETURNING
    id,
    feature_request_id,
    author_user_id,
    author_role,
    author_username,
    content,
    created_at
`

export const FEATURE_REQUEST_COMMENT_COUNT_SUBQUERY_SQL = `
  SELECT COUNT(*)
  FROM feature_request_comments c
  WHERE c.feature_request_id = fr.id
    AND c.ga_id = fr.ga_id
`
