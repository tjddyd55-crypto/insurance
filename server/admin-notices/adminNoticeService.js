import { safeQuery } from '../utils/dbSafeQuery.js'
import { getR2PublicCdnBase } from '../lib/consentStorage.js'
import { assertInsuranceStorageKeyPrefix } from '../storage/insuranceStorageKeys.js'
import { getKstEndOfDayDate } from '../services/userNotificationService.js'
import {
  ADMIN_NOTICE_STATUSES,
  comparePopupNotices,
  derivePlainText,
  isActivePopupCandidate,
  isNoticeDismissedActive,
  normalizeContentBlocks,
} from './adminNoticeLogic.js'

/**
 * @param {unknown} row
 */
export function mapAdminNoticeRow(row) {
  const contentBlocks = Array.isArray(row?.content_json) ? row.content_json : []
  return {
    id: Number(row.id),
    title: String(row.title ?? ''),
    contentBlocks,
    plainText: row.plain_text != null ? String(row.plain_text) : derivePlainText(contentBlocks),
    status: String(row.status ?? 'draft'),
    showAsPopup: row.show_as_popup === true,
    popupPriority: Number(row.popup_priority ?? 0),
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

/**
 * @param {import('pg').Pool} pool
 */
export async function listAdminNotices(pool) {
  const { rows } = await safeQuery(
    pool,
    `
    SELECT *
    FROM admin_notices
    ORDER BY updated_at DESC, id DESC
    `,
  )
  return rows.map(mapAdminNoticeRow)
}

/**
 * @param {import('pg').Pool} pool
 * @param {string | number} id
 */
export async function getAdminNoticeById(pool, id) {
  const noticeId = Number(id)
  if (!Number.isFinite(noticeId) || noticeId <= 0) {
    throw new Error('notice_not_found')
  }
  const { rows } = await safeQuery(pool, `SELECT * FROM admin_notices WHERE id = $1`, [noticeId])
  if (!rows[0]) {
    throw new Error('notice_not_found')
  }
  return mapAdminNoticeRow(rows[0])
}

/**
 * @param {unknown} value
 */
function parseOptionalDate(value) {
  if (value == null || value === '') {
    return null
  }
  const date = new Date(String(value))
  if (!Number.isFinite(date.getTime())) {
    throw new Error('invalid_date')
  }
  return date.toISOString()
}

/**
 * @param {unknown} body
 */
function parseNoticeInput(body) {
  const payload = body && typeof body === 'object' ? body : {}
  const title = String(payload.title ?? '').trim()
  if (!title) {
    throw new Error('title_required')
  }
  const contentBlocks = normalizeContentBlocks(payload.contentBlocks ?? payload.content_json ?? [])
  const statusRaw = String(payload.status ?? 'draft').trim().toLowerCase()
  const status = ADMIN_NOTICE_STATUSES.includes(statusRaw) ? statusRaw : 'draft'
  const showAsPopup = payload.showAsPopup === true || payload.show_as_popup === true
  const popupPriority = Number(payload.popupPriority ?? payload.popup_priority ?? 0)
  if (!Number.isFinite(popupPriority)) {
    throw new Error('invalid_popup_priority')
  }
  return {
    title,
    contentBlocks,
    plainText: derivePlainText(contentBlocks),
    status,
    showAsPopup,
    popupPriority,
    startsAt: parseOptionalDate(payload.startsAt ?? payload.starts_at),
    endsAt: parseOptionalDate(payload.endsAt ?? payload.ends_at),
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {boolean} showAsPopup
 * @param {number | null} exceptId
 */
async function clearOtherPopupFlags(pool, showAsPopup, exceptId = null) {
  if (!showAsPopup) {
    return
  }
  if (exceptId != null) {
    await safeQuery(
      pool,
      `UPDATE admin_notices SET show_as_popup = false, updated_at = NOW() WHERE show_as_popup = true AND id <> $1`,
      [exceptId],
    )
    return
  }
  await safeQuery(pool, `UPDATE admin_notices SET show_as_popup = false, updated_at = NOW() WHERE show_as_popup = true`)
}

/**
 * @param {import('pg').Pool} pool
 * @param {unknown} body
 * @param {string | null} actorUserId
 */
export async function createAdminNotice(pool, body, actorUserId) {
  const input = parseNoticeInput(body)
  await clearOtherPopupFlags(pool, input.showAsPopup)
  const { rows } = await safeQuery(
    pool,
    `
    INSERT INTO admin_notices (
      title, content_json, plain_text, status, show_as_popup, popup_priority,
      starts_at, ends_at, created_by, updated_by
    )
    VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $9)
    RETURNING *
    `,
    [
      input.title,
      JSON.stringify(input.contentBlocks),
      input.plainText,
      input.status,
      input.showAsPopup,
      input.popupPriority,
      input.startsAt,
      input.endsAt,
      actorUserId,
    ],
  )
  return mapAdminNoticeRow(rows[0])
}

/**
 * @param {import('pg').Pool} pool
 * @param {string | number} id
 * @param {unknown} body
 * @param {string | null} actorUserId
 */
export async function updateAdminNotice(pool, id, body, actorUserId) {
  const noticeId = Number(id)
  if (!Number.isFinite(noticeId) || noticeId <= 0) {
    throw new Error('notice_not_found')
  }
  const input = parseNoticeInput(body)
  await clearOtherPopupFlags(pool, input.showAsPopup, noticeId)
  const { rows } = await safeQuery(
    pool,
    `
    UPDATE admin_notices
    SET title = $2,
        content_json = $3::jsonb,
        plain_text = $4,
        status = $5,
        show_as_popup = $6,
        popup_priority = $7,
        starts_at = $8,
        ends_at = $9,
        updated_by = $10,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      noticeId,
      input.title,
      JSON.stringify(input.contentBlocks),
      input.plainText,
      input.status,
      input.showAsPopup,
      input.popupPriority,
      input.startsAt,
      input.endsAt,
      actorUserId,
    ],
  )
  if (!rows[0]) {
    throw new Error('notice_not_found')
  }
  return mapAdminNoticeRow(rows[0])
}

/**
 * @param {import('pg').Pool} pool
 * @param {string | number} id
 */
export async function deleteAdminNotice(pool, id) {
  const noticeId = Number(id)
  if (!Number.isFinite(noticeId) || noticeId <= 0) {
    throw new Error('notice_not_found')
  }
  const { rowCount } = await safeQuery(pool, `DELETE FROM admin_notices WHERE id = $1`, [noticeId])
  if (!rowCount) {
    throw new Error('notice_not_found')
  }
  return { ok: true }
}

/**
 * @param {import('pg').Pool} pool
 * @param {string | number} id
 * @param {string | null} actorUserId
 */
export async function publishAdminNotice(pool, id, actorUserId) {
  return updateAdminNoticeStatus(pool, id, 'published', actorUserId)
}

/**
 * @param {import('pg').Pool} pool
 * @param {string | number} id
 * @param {string | null} actorUserId
 */
export async function archiveAdminNotice(pool, id, actorUserId) {
  return updateAdminNoticeStatus(pool, id, 'archived', actorUserId)
}

/**
 * @param {import('pg').Pool} pool
 * @param {string | number} id
 * @param {string} status
 * @param {string | null} actorUserId
 */
async function updateAdminNoticeStatus(pool, id, status, actorUserId) {
  const noticeId = Number(id)
  if (!Number.isFinite(noticeId) || noticeId <= 0) {
    throw new Error('notice_not_found')
  }
  const { rows } = await safeQuery(
    pool,
    `
    UPDATE admin_notices
    SET status = $2,
        updated_by = $3,
        updated_at = NOW(),
        show_as_popup = CASE WHEN $2 = 'archived' THEN false ELSE show_as_popup END
    WHERE id = $1
    RETURNING *
    `,
    [noticeId, status, actorUserId],
  )
  if (!rows[0]) {
    throw new Error('notice_not_found')
  }
  return mapAdminNoticeRow(rows[0])
}

/**
 * @param {import('pg').Pool} pool
 * @param {string | number} id
 * @param {string | null} actorUserId
 */
export async function setAdminNoticePopup(pool, id, actorUserId) {
  const noticeId = Number(id)
  if (!Number.isFinite(noticeId) || noticeId <= 0) {
    throw new Error('notice_not_found')
  }
  const notice = await getAdminNoticeById(pool, noticeId)
  if (notice.status !== 'published') {
    throw new Error('notice_not_published')
  }
  await clearOtherPopupFlags(pool, true, noticeId)
  const { rows } = await safeQuery(
    pool,
    `
    UPDATE admin_notices
    SET show_as_popup = true,
        updated_by = $2,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [noticeId, actorUserId],
  )
  return mapAdminNoticeRow(rows[0])
}

/**
 * @param {AdminNoticeContentBlock[]} blocks
 * @param {string} cdnBase
 */
export function enrichNoticeBlocksWithPublicUrls(blocks, cdnBase = getR2PublicCdnBase()) {
  return blocks.map((block) => {
    if (block.type !== 'image') {
      return block
    }
    const storageKey = block.storageKey ? assertInsuranceStorageKeyPrefix(block.storageKey) : ''
    const url = block.url?.trim() || (storageKey ? `${cdnBase}/${storageKey}` : '')
    return { ...block, storageKey, url }
  })
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} userId
 */
export async function getActivePopupNoticeForUser(pool, userId) {
  const { rows } = await safeQuery(
    pool,
    `
    SELECT n.*,
           d.dismissed_until,
           d.dismissed_forever
    FROM admin_notices n
    LEFT JOIN user_notice_dismissals d
      ON d.user_id = $1 AND d.notice_id = n.id
    WHERE n.status = 'published'
      AND n.show_as_popup = true
      AND (n.starts_at IS NULL OR n.starts_at <= NOW())
      AND (n.ends_at IS NULL OR n.ends_at >= NOW())
    ORDER BY n.popup_priority DESC, n.updated_at DESC, n.id DESC
    `,
    [userId],
  )

  const now = new Date()
  const candidates = rows
    .map((row) => ({
      notice: mapAdminNoticeRow(row),
      dismissal: {
        dismissedUntil: row.dismissed_until ?? null,
        dismissedForever: row.dismissed_forever === true,
      },
    }))
    .filter(({ notice, dismissal }) => isActivePopupCandidate(notice, now) && !isNoticeDismissedActive(dismissal, now))
    .sort((a, b) => comparePopupNotices(a.notice, b.notice))

  const winner = candidates[0]?.notice ?? null
  if (!winner) {
    return null
  }
  return {
    id: winner.id,
    title: winner.title,
    contentBlocks: enrichNoticeBlocksWithPublicUrls(winner.contentBlocks),
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} userId
 * @param {string | number} noticeIdRaw
 * @param {{ suppressToday?: boolean, forever?: boolean }} options
 */
export async function dismissAdminNoticeForUser(pool, userId, noticeIdRaw, options = {}) {
  const noticeId = Number(noticeIdRaw)
  if (!Number.isFinite(noticeId) || noticeId <= 0) {
    throw new Error('notice_not_found')
  }
  await getAdminNoticeById(pool, noticeId)

  const dismissedForever = options.forever === true
  const dismissedUntil = options.suppressToday === true ? getKstEndOfDayDate().toISOString() : null

  await safeQuery(
    pool,
    `
    INSERT INTO user_notice_dismissals (user_id, notice_id, dismissed_until, dismissed_forever)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, notice_id) DO UPDATE
    SET dismissed_until = EXCLUDED.dismissed_until,
        dismissed_forever = CASE
          WHEN EXCLUDED.dismissed_forever THEN true
          ELSE user_notice_dismissals.dismissed_forever
        END
    `,
    [userId, noticeId, dismissedUntil, dismissedForever],
  )

  return { ok: true, dismissedUntil, dismissedForever }
}
