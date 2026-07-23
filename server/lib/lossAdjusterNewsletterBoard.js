/**
 * GA별 손해사정사 소식지(LOSS_ADJUSTER) 기본 보드 설정.
 * 게시글 payload.newsChannel 과 메뉴 path 는 변경하지 않는다.
 * 원수사(INSURER) 채널은 다루지 않는다.
 */

import { randomUUID } from 'crypto'

/** 게시글·알림 immutable 채널 키 (CLAIM_ADJUSTER 아님) */
export const LOSS_ADJUSTER_SYSTEM_KEY = 'LOSS_ADJUSTER'

export const LOSS_ADJUSTER_DEFAULT_LABEL = '손해사정사 소식지'

/** GA 내 고정 slug — 메뉴 path 는 /portal/adjuster-news 유지 */
export const LOSS_ADJUSTER_BOARD_SLUG = 'system-loss-adjuster'

export const LOSS_ADJUSTER_PORTAL_PATH = '/portal/adjuster-news'

export function isLossAdjusterSystemBoard(board) {
  if (!board || typeof board !== 'object') {
    return false
  }
  const key = String(board.systemKey ?? board.system_key ?? '').trim().toUpperCase()
  return key === LOSS_ADJUSTER_SYSTEM_KEY
}

/**
 * @param {import('pg').Pool | { query: Function }} pool
 * @param {number} gaId
 * @param {{ createdByUserId?: string | null }} [options]
 */
export async function ensureLossAdjusterNewsletterBoard(pool, gaId, options = {}) {
  const ownerGaId = Number(gaId)
  if (!Number.isInteger(ownerGaId) || ownerGaId < 1) {
    return null
  }

  const existing = await pool.query(
    `
    SELECT *
    FROM newsletter_boards
    WHERE owner_ga_id = $1
      AND system_key = $2
      AND is_deleted = false
    LIMIT 1
    `,
    [ownerGaId, LOSS_ADJUSTER_SYSTEM_KEY],
  )
  if (existing.rowCount > 0) {
    return existing.rows[0]
  }

  const id = randomUUID()
  const createdBy = options.createdByUserId ? String(options.createdByUserId) : null
  try {
    const inserted = await pool.query(
      `
      INSERT INTO newsletter_boards (
        id, ga_id, slug, label, description, sort_order, is_active,
        is_public, content_scope, board_scope, owner_ga_id, system_key, created_by_user_id
      )
      VALUES (
        $1, NULL, $2, $3, NULL, 0, true,
        false, 'ga', 'ga', $4, $5, $6
      )
      RETURNING *
      `,
      [
        id,
        LOSS_ADJUSTER_BOARD_SLUG,
        LOSS_ADJUSTER_DEFAULT_LABEL,
        ownerGaId,
        LOSS_ADJUSTER_SYSTEM_KEY,
        createdBy,
      ],
    )
    return inserted.rows[0]
  } catch (err) {
    // 동시 ensure 경쟁 — 재조회
    const again = await pool.query(
      `
      SELECT *
      FROM newsletter_boards
      WHERE owner_ga_id = $1
        AND system_key = $2
        AND is_deleted = false
      LIMIT 1
      `,
      [ownerGaId, LOSS_ADJUSTER_SYSTEM_KEY],
    )
    if (again.rowCount > 0) {
      return again.rows[0]
    }
    throw err
  }
}

/**
 * @param {import('pg').Pool | { query: Function }} pool
 * @param {number} gaId
 */
export async function isLossAdjusterNewsletterActiveForGa(pool, gaId) {
  const ownerGaId = Number(gaId)
  if (!Number.isInteger(ownerGaId) || ownerGaId < 1) {
    return true
  }
  await ensureLossAdjusterNewsletterBoard(pool, ownerGaId)
  const r = await pool.query(
    `
    SELECT COALESCE(is_active, true) AS is_active
    FROM newsletter_boards
    WHERE owner_ga_id = $1
      AND system_key = $2
      AND is_deleted = false
    LIMIT 1
    `,
    [ownerGaId, LOSS_ADJUSTER_SYSTEM_KEY],
  )
  if (r.rowCount === 0) {
    return true
  }
  return Boolean(r.rows[0].is_active)
}

/**
 * @param {import('pg').Pool | { query: Function }} pool
 * @param {number} gaId
 */
export async function getLossAdjusterNewsletterLabelForGa(pool, gaId) {
  const ownerGaId = Number(gaId)
  if (!Number.isInteger(ownerGaId) || ownerGaId < 1) {
    return LOSS_ADJUSTER_DEFAULT_LABEL
  }
  await ensureLossAdjusterNewsletterBoard(pool, ownerGaId)
  const r = await pool.query(
    `
    SELECT label
    FROM newsletter_boards
    WHERE owner_ga_id = $1
      AND system_key = $2
      AND is_deleted = false
    LIMIT 1
    `,
    [ownerGaId, LOSS_ADJUSTER_SYSTEM_KEY],
  )
  const label = String(r.rows[0]?.label ?? '').trim()
  return label || LOSS_ADJUSTER_DEFAULT_LABEL
}
