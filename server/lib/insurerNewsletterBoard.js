import { randomUUID } from 'node:crypto'

export const INSURER_BOARD_SLUG = 'system-insurer'
export const INSURER_BOARD_LABEL = '원수사 게시판'

/** Create only the default insurer board for a newly created GA; never backfill existing GAs. */
export async function ensureInsurerNewsletterBoard(executor, gaId) {
  const ownerGaId = Number(gaId)
  if (!Number.isInteger(ownerGaId) || ownerGaId < 1) throw new Error('invalid_ga_id')
  const found = await executor.query(
    `SELECT * FROM newsletter_boards WHERE owner_ga_id = $1 AND slug = $2 AND is_deleted = false LIMIT 1`,
    [ownerGaId, INSURER_BOARD_SLUG],
  )
  if (found.rows?.[0]) return found.rows[0]
  try {
    const created = await executor.query(
      `INSERT INTO newsletter_boards (
        id, ga_id, slug, label, description, sort_order, is_active,
        is_public, content_scope, board_scope, owner_ga_id
      ) VALUES ($1, NULL, $2, $3, NULL, 0, true, false, 'ga', 'ga', $4)
      ON CONFLICT DO NOTHING RETURNING *`,
      [randomUUID(), INSURER_BOARD_SLUG, INSURER_BOARD_LABEL, ownerGaId],
    )
    if (created.rows?.[0]) return created.rows[0]
  } catch (error) {
    if (error?.code !== '23505') throw error
  }
  const again = await executor.query(
    `SELECT * FROM newsletter_boards WHERE owner_ga_id = $1 AND slug = $2 AND is_deleted = false LIMIT 1`,
    [ownerGaId, INSURER_BOARD_SLUG],
  )
  if (!again.rows?.[0]) throw new Error('insurer_board_provision_failed')
  return again.rows[0]
}
