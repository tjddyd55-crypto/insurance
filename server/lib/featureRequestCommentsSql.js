/** 기능 요청 댓글 — safeQuery GA scope 필수 SQL (단일 진실 원천) */

export const FEATURE_REQUEST_COMMENT_SELECT_SQL = `
  SELECT id, feature_request_id, author_user_id, author_role, author_username, content, created_at
  FROM feature_request_comments
  WHERE feature_request_id = $1
    AND ga_id = $2
  ORDER BY created_at ASC, id ASC
  LIMIT 500
`

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
  RETURNING id, feature_request_id, author_user_id, author_role, author_username, content, created_at
`

export const FEATURE_REQUEST_COMMENT_COUNT_SUBQUERY_SQL = `
  SELECT COUNT(*)
  FROM feature_request_comments c
  WHERE c.feature_request_id = fr.id
    AND c.ga_id = fr.ga_id
`
