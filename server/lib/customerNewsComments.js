import { randomUUID } from 'node:crypto'

export const CUSTOMER_NEWS_COMMENT_MAX_LENGTH = 2000

/**
 * @param {{
 *   id?: string
 *   newsletter_id?: string
 *   news_id?: string
 *   author_type?: string
 *   author_name?: string
 *   content?: string
 *   created_at?: Date | string | null
 * }} row
 */
export function mapCustomerNewsCommentRow(row) {
  const authorType = row?.author_type === 'customer' ? 'customer' : 'agent'
  const authorName = String(row?.author_name ?? '').trim()
  return {
    id: String(row?.id ?? ''),
    newsId: String(row?.newsletter_id ?? row?.news_id ?? ''),
    authorType,
    authorName: authorName || (authorType === 'customer' ? '고객' : '담당자'),
    content: String(row?.content ?? ''),
    createdAt: row?.created_at ? new Date(row.created_at).toISOString() : null,
  }
}

/**
 * @param {unknown} content
 * @returns {{ ok: true; content: string } | { ok: false; status: number; message: string }}
 */
export function validateCustomerNewsCommentContent(content) {
  const trimmed = String(content ?? '').trim()
  if (!trimmed) {
    return { ok: false, status: 400, message: '댓글 내용을 입력해 주세요.' }
  }
  if (trimmed.length > CUSTOMER_NEWS_COMMENT_MAX_LENGTH) {
    return {
      ok: false,
      status: 400,
      message: `댓글은 ${CUSTOMER_NEWS_COMMENT_MAX_LENGTH}자 이하로 입력해 주세요.`,
    }
  }
  return { ok: true, content: trimmed }
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ newsId: string; agentId: string; gaId: number }} params
 */
export async function loadCustomerNewsForAgentComment(pool, { newsId, agentId, gaId }) {
  const r = await pool.query(
    `
    SELECT n.id
    FROM insurance_company_newsletters n
    WHERE n.id = $1
      AND n.ga_id = $2
      AND n.status = 'PUBLISHED'
      AND n.deleted_at IS NULL
      AND COALESCE((n.payload->>'customerVisible')::boolean, false) = true
      AND COALESCE(NULLIF(TRIM(n.payload->>'publisherId'), ''), '') = $3
    LIMIT 1
    `,
    [newsId, gaId, agentId],
  )
  if (r.rowCount === 0) {
    return { ok: false, status: 404, message: '소식지를 찾을 수 없습니다.' }
  }
  return { ok: true, newsletterId: String(r.rows[0].id) }
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ newsId: string; gaId: number }} params
 */
export async function listCustomerNewsComments(pool, { newsId, gaId }) {
  const r = await pool.query(
    `
    SELECT
      c.id,
      c.newsletter_id,
      c.author_type,
      c.author_name,
      c.content,
      c.created_at
    FROM customer_news_comments c
    INNER JOIN insurance_company_newsletters n ON n.id = c.newsletter_id
    WHERE c.newsletter_id = $1
      AND c.ga_id = $2
      AND n.deleted_at IS NULL
    ORDER BY c.created_at ASC, c.id ASC
    `,
    [newsId, gaId],
  )
  return r.rows.map((row) => mapCustomerNewsCommentRow(row))
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} agentId
 */
export async function resolveAgentDisplayName(pool, agentId) {
  const r = await pool.query(
    `
    SELECT
      COALESCE(
        NULLIF(TRIM(display_name), ''),
        NULLIF(TRIM(name), ''),
        NULLIF(TRIM(username), ''),
        ''
      ) AS display_name
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [agentId],
  )
  return String(r.rows[0]?.display_name ?? '').trim() || '담당자'
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ newsId: string; gaId: number; agentId: string; content: string }} params
 */
export async function insertCustomerNewsComment(pool, { newsId, gaId, agentId, content }) {
  const authorName = await resolveAgentDisplayName(pool, agentId)
  const id = randomUUID()
  const r = await pool.query(
    `
    INSERT INTO customer_news_comments
      (id, newsletter_id, ga_id, author_user_id, author_type, author_name, content, created_at, updated_at)
    VALUES ($1, $2, $3, $4, 'agent', $5, $6, NOW(), NOW())
    RETURNING id, newsletter_id, author_type, author_name, content, created_at
    `,
    [id, newsId, gaId, agentId, authorName, content],
  )
  return mapCustomerNewsCommentRow(r.rows[0])
}
