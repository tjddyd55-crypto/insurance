import { randomUUID } from 'node:crypto'
import { isGlobalContentScope } from './newsletterBoardScope.js'

/**
 * 동적 소식지 게시판 글 INSERT 공통 로직.
 * @param {import('pg').PoolClient | import('pg').Pool} executor
 * @param {{
 *   board: { slug: string, label: string, content_scope?: string, contentScope?: string },
 *   gaId: number | null,
 *   bodyText: string,
 *   status: 'DRAFT' | 'PUBLISHED',
 *   publisherId?: string | null,
 * }} input
 */
export async function insertDynamicBoardNewsletter(executor, input) {
  const { board, gaId, bodyText, status, publisherId } = input
  const slug = String(board.slug ?? '').trim()
  const label = String(board.label ?? '').trim() || slug
  const global = isGlobalContentScope(board.content_scope ?? board.contentScope)
  if (global && gaId != null) {
    throw Object.assign(new Error('전체 공용 게시글은 ga_id 없이 저장해야 합니다.'), { httpStatus: 400 })
  }
  if (!global) {
    const gaNum = Number(gaId)
    if (!Number.isInteger(gaNum) || gaNum < 1) {
      throw Object.assign(new Error('GA 컨텍스트가 없습니다.'), { httpStatus: 400 })
    }
  }
  const id = randomUUID()
  const nowIso = new Date().toISOString()
  const payload = {
    dynamicBoardSlug: slug,
    contentScope: global ? 'global' : 'ga',
    insurerSlug: `board-${slug}`,
    insurerCode: 'BOARD',
    insurerName: label,
    newsChannel: 'INSURER',
    publishedAt: status === 'PUBLISHED' ? nowIso : null,
    publisherId: publisherId ? String(publisherId) : null,
  }
  const insRes = await executor.query(
    `
    INSERT INTO insurance_company_newsletters
      (id, ga_id, company_id, company_name_snapshot, title, status, body_text, payload, created_at, updated_at)
    VALUES ($1, $2, NULL, $3, '', $4, $5, CAST($6 AS jsonb), NOW(), NOW())
    RETURNING *
    `,
    [
      id,
      global ? null : Number(gaId),
      label,
      status,
      String(bodyText ?? ''),
      JSON.stringify(payload),
    ],
  )
  return insRes.rows[0]
}
