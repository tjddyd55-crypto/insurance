import { systemQuery } from '../utils/dbSafeQuery.js'
import { assertAdvisorPublicObjectKeyOwned } from './publicAdvisorMedia.js'
import { GALLERY_MAX } from './publicAdvisorProfileService.js'

export async function countGalleryItems(pool, userId) {
  const r = await systemQuery(
    pool,
    `SELECT COUNT(*)::int AS c FROM advisor_public_profile_gallery WHERE user_id = $1`,
    [userId],
  )
  return Number(r.rows[0]?.c ?? 0)
}

export async function addGalleryItem(pool, userId, { objectKey, caption }) {
  if (!assertAdvisorPublicObjectKeyOwned(userId, objectKey)) {
    return { ok: false, status: 400, message: '유효하지 않은 이미지 경로입니다.' }
  }
  const count = await countGalleryItems(pool, userId)
  if (count >= GALLERY_MAX) {
    return { ok: false, status: 400, message: `사진은 최대 ${GALLERY_MAX}장까지 등록할 수 있습니다.` }
  }
  const sort = count
  const r = await systemQuery(
    pool,
    `
    INSERT INTO advisor_public_profile_gallery (user_id, object_key, caption, sort_order)
    VALUES ($1, $2, $3, $4)
    RETURNING id, object_key, caption, sort_order
    `,
    [userId, objectKey, String(caption ?? '').slice(0, 200), sort],
  )
  return { ok: true, item: r.rows[0] }
}

export async function deleteGalleryItem(pool, userId, galleryId) {
  const r = await systemQuery(
    pool,
    `DELETE FROM advisor_public_profile_gallery WHERE id = $1 AND user_id = $2 RETURNING id`,
    [galleryId, userId],
  )
  if (r.rowCount === 0) {
    return { ok: false, status: 404, message: '사진을 찾을 수 없습니다.' }
  }
  await reindexGallerySort(pool, userId)
  return { ok: true }
}

export async function updateGalleryCaption(pool, userId, galleryId, caption) {
  const r = await systemQuery(
    pool,
    `
    UPDATE advisor_public_profile_gallery
    SET caption = $3
    WHERE id = $1 AND user_id = $2
    RETURNING id, object_key, caption, sort_order
    `,
    [galleryId, userId, String(caption ?? '').slice(0, 200)],
  )
  if (r.rowCount === 0) {
    return { ok: false, status: 404, message: '사진을 찾을 수 없습니다.' }
  }
  return { ok: true, item: r.rows[0] }
}

async function reindexGallerySort(pool, userId) {
  const rows = await systemQuery(
    pool,
    `SELECT id FROM advisor_public_profile_gallery WHERE user_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [userId],
  )
  for (let i = 0; i < rows.rows.length; i += 1) {
    await systemQuery(pool, `UPDATE advisor_public_profile_gallery SET sort_order = $2 WHERE id = $1`, [
      rows.rows[i].id,
      i,
    ])
  }
}

/**
 * @param {string[]} orderedIds UUID strings in desired order
 */
export async function reorderGallery(pool, userId, orderedIds) {
  const ids = Array.isArray(orderedIds) ? orderedIds.map((id) => String(id).trim()).filter(Boolean) : []
  if (ids.length === 0) {
    return { ok: false, status: 400, message: '순서 정보가 없습니다.' }
  }
  const existing = await systemQuery(
    pool,
    `SELECT id FROM advisor_public_profile_gallery WHERE user_id = $1 ORDER BY sort_order ASC`,
    [userId],
  )
  const existingIds = existing.rows.map((r) => String(r.id))
  if (ids.length !== existingIds.length || ids.some((id) => !existingIds.includes(id))) {
    return { ok: false, status: 400, message: '사진 목록과 순서가 일치하지 않습니다.' }
  }
  for (let i = 0; i < ids.length; i += 1) {
    await systemQuery(pool, `UPDATE advisor_public_profile_gallery SET sort_order = $2 WHERE id = $1 AND user_id = $3`, [
      ids[i],
      i,
      userId,
    ])
  }
  return { ok: true }
}
