import { loadBinderDetail } from './personalBinderDetail.js'
import { consentGetBuffer } from '../lib/consentStorage.js'
import { safeQuery } from '../utils/dbSafeQuery.js'
import { binderMaterialChecksum, normalizeBinderMaterialMime } from './binderMaterialUtils.js'
import { copyR2ObjectForBinderShare } from './personalBinderShareR2.js'
import {
  assertR2ObjectsExist,
  compensateR2ObjectKeys,
} from './personalBinderShareR2Compensation.js'
import { buildPersonalBinderGaShareSnapshotObjectKey } from './personalBinderShareStorageKeys.js'

function mapShareListRow(row) {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name ?? null,
    gaId: Number(row.ga_id),
    sectionCount: Number(row.section_count) || 0,
    fileCount: Number(row.file_count) || 0,
    totalBytes: Number(row.total_bytes) || 0,
    shareVersion: Number(row.share_version) || 1,
    sourceBinderId: row.source_binder_id != null ? String(row.source_binder_id) : null,
    createdAt: row.created_at,
    status: row.status,
  }
}

async function assertOwnedBinder(executor, binderId, scope) {
  const result = await safeQuery(
    executor,
    `
    SELECT id, title, description
    FROM personal_binders
    WHERE id = $1 AND owner_user_id = $2 AND ga_id = $3 AND deleted_at IS NULL
    LIMIT 1
    `,
    [binderId, scope.userId, scope.gaId],
  )
  return result.rows[0] ?? null
}

async function loadShareRow(executor, shareId, gaId) {
  const result = await safeQuery(
    executor,
    `
    SELECT
      s.*,
      COALESCE(NULLIF(TRIM(u.display_name), ''), NULLIF(TRIM(u.name), ''), u.username) AS owner_name
    FROM personal_binder_ga_shares s
    LEFT JOIN users u ON u.id = s.owner_user_id
    WHERE s.id = $1 AND s.ga_id = $2
    LIMIT 1
    `,
    [shareId, gaId],
  )
  return result.rows[0] ?? null
}

async function assertActiveShareAccess(executor, shareId, scope) {
  const row = await loadShareRow(executor, shareId, scope.gaId)
  if (!row || row.status !== 'active') {
    throw Object.assign(new Error('공유 바인더를 찾을 수 없습니다.'), { httpStatus: 404 })
  }
  return row
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
/** page_selection 직렬화: null/undefined → SQL NULL, 배열 → JSON 배열, JSON 문자열 배열도 허용. 그 외는 NULL(전체). */
export function serializeSharePageSelection(value) {
  let v = value
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v)
    } catch {
      return null
    }
  }
  if (!Array.isArray(v)) return null
  return JSON.stringify(v)
}

export async function getActiveShareForBinder(executor, scope, binderId) {
  const result = await safeQuery(
    executor,
    `
    SELECT id, title, created_at, status
    FROM personal_binder_ga_shares
    WHERE source_binder_id = $1
      AND owner_user_id = $2
      AND ga_id = $3
      AND status = 'active'
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    `,
    [binderId, scope.userId, scope.gaId],
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    shareId: String(row.id),
    title: row.title,
    createdAt: row.created_at,
    status: row.status,
  }
}

export async function listGaSharedBinders(pool, scope) {
  const result = await safeQuery(
    pool,
    `
    SELECT
      s.*,
      COALESCE(NULLIF(TRIM(u.display_name), ''), NULLIF(TRIM(u.name), ''), u.username) AS owner_name
    FROM personal_binder_ga_shares s
    LEFT JOIN users u ON u.id = s.owner_user_id
    WHERE s.ga_id = $1 AND s.status = 'active'
    ORDER BY s.created_at DESC, s.id DESC
    `,
    [scope.gaId],
  )
  return result.rows.map(mapShareListRow)
}

export async function loadSharedBinderDetail(pool, scope, shareId) {
  const share = await assertActiveShareAccess(pool, shareId, scope)
  const sections = await safeQuery(
    pool,
    `
    SELECT id, title, sort_order
    FROM personal_binder_ga_share_sections
    WHERE share_id = $1 AND ga_id = $2
    ORDER BY sort_order ASC, id ASC
    `,
    [shareId, scope.gaId],
  )
  const items = await safeQuery(
    pool,
    `
    SELECT
      i.id,
      i.share_section_id,
      i.share_file_id,
      i.sort_order,
      i.page_selection,
      f.material_title,
      f.original_file_name,
      f.mime_type,
      f.file_size,
      f.page_count
    FROM personal_binder_ga_share_items i
    INNER JOIN personal_binder_ga_share_files f
      ON f.id = i.share_file_id AND f.ga_id = i.ga_id
    WHERE f.share_id = $1 AND f.ga_id = $2
    ORDER BY i.share_section_id, i.sort_order ASC, i.id ASC
    `,
    [shareId, scope.gaId],
  )
  const bySection = new Map()
  for (const item of items.rows) {
    const key = String(item.share_section_id)
    const rows = bySection.get(key) ?? []
    rows.push({
      id: String(item.id),
      shareFileId: String(item.share_file_id),
      sortOrder: Number(item.sort_order),
      pageSelection: item.page_selection,
      material: {
        title: item.material_title,
        originalFileName: item.original_file_name,
        mimeType: item.mime_type,
        fileSize: Number(item.file_size) || 0,
        pageCount: Number(item.page_count) || 0,
      },
    })
    bySection.set(key, rows)
  }
  return {
    ...mapShareListRow(share),
    sections: sections.rows.map((section) => ({
      id: String(section.id),
      title: section.title,
      sortOrder: Number(section.sort_order),
      items: bySection.get(String(section.id)) ?? [],
    })),
  }
}

export async function revokePersonalBinderGaShare(pool, scope, shareId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const share = await safeQuery(
      client,
      `
      SELECT id, owner_user_id, status
      FROM personal_binder_ga_shares
      WHERE id = $1 AND ga_id = $2
      LIMIT 1
      FOR UPDATE
      `,
      [shareId, scope.gaId],
    )
    const row = share.rows[0]
    if (!row) {
      throw Object.assign(new Error('공유 바인더를 찾을 수 없습니다.'), { httpStatus: 404 })
    }
    if (row.owner_user_id !== scope.userId) {
      throw Object.assign(new Error('공유 해제 권한이 없습니다.'), { httpStatus: 403 })
    }
    if (row.status === 'revoked') {
      await client.query('COMMIT')
      return { ok: true }
    }
    await safeQuery(
      client,
      `
      UPDATE personal_binder_ga_shares
      SET status = 'revoked', revoked_at = NOW()
      WHERE id = $1 AND owner_user_id = $2 AND ga_id = $3
      `,
      [shareId, scope.userId, scope.gaId],
    )
    await client.query('COMMIT')
    return { ok: true }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ userId: string, gaId: number }} scope
 * @param {string} gaCode
 * @param {number} binderId
 */
export async function createPersonalBinderGaShare(pool, scope, gaCode, binderId) {
  const owned = await assertOwnedBinder(pool, binderId, scope)
  if (!owned) {
    throw Object.assign(new Error('바인더를 찾을 수 없습니다.'), { httpStatus: 404 })
  }
  const detail = await loadBinderDetail(pool, binderId, scope)
  if (!detail) {
    throw Object.assign(new Error('바인더를 찾을 수 없습니다.'), { httpStatus: 404 })
  }

  const materials = await safeQuery(
    pool,
    `
    SELECT DISTINCT
      m.id AS material_id,
      m.file_id,
      m.title AS material_title,
      m.original_file_name,
      m.mime_type,
      m.file_size,
      m.page_count,
      m.checksum_sha256,
      f.file_path
    FROM personal_binder_items i
    INNER JOIN personal_binder_sections s ON s.id = i.section_id
    INNER JOIN personal_binder_materials m ON m.id = i.material_id
    INNER JOIN files f ON f.id = m.file_id
    WHERE s.binder_id = $1
      AND m.owner_user_id = $2
      AND m.ga_id = $3
      AND m.deleted_at IS NULL
      AND f.user_id = $2
      AND f.ga_id = $3
      AND f.deleted_at IS NULL
      AND f.status = 'active'
    `,
    [binderId, scope.userId, scope.gaId],
  )

  const client = await pool.connect()
  const stagedObjectKeys = []
  let shareId = null
  try {
    await client.query('BEGIN')

    const versionResult = await safeQuery(
      client,
      `
      SELECT COALESCE(MAX(share_version), 0) + 1 AS next_version
      FROM personal_binder_ga_shares
      WHERE source_binder_id = $1 AND owner_user_id = $2 AND ga_id = $3
      `,
      [binderId, scope.userId, scope.gaId],
    )
    const shareVersion = Number(versionResult.rows[0]?.next_version) || 1

    const shareInsert = await safeQuery(
      client,
      `
      INSERT INTO personal_binder_ga_shares (
        ga_id, owner_user_id, source_binder_id, title, description,
        share_version, status, section_count, file_count, total_bytes
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'creating', $7, $8, 0)
      RETURNING id
      `,
      [
        scope.gaId,
        scope.userId,
        binderId,
        owned.title,
        owned.description ?? '',
        shareVersion,
        detail.sections.length,
        0,
      ],
    )
    shareId = Number(shareInsert.rows[0].id)

    const materialToShareFile = new Map()
    let totalBytes = 0

    for (const material of materials.rows) {
      const materialId = Number(material.material_id)
      const sourceKey = String(material.file_path ?? '').trim()
      if (!sourceKey) {
        throw Object.assign(new Error('공유할 파일 경로를 확인할 수 없습니다.'), { httpStatus: 400 })
      }
      const mimeType = normalizeBinderMaterialMime(
        material.mime_type,
        material.original_file_name,
      )
      const destKey = buildPersonalBinderGaShareSnapshotObjectKey({
        gaCode,
        shareId,
        originalName: material.original_file_name,
      })
      await copyR2ObjectForBinderShare(sourceKey, destKey, mimeType)
      stagedObjectKeys.push(destKey)
      await assertR2ObjectsExist([destKey])
      const buffer = await consentGetBuffer(destKey)
      const checksum =
        material.checksum_sha256 ??
        (Buffer.isBuffer(buffer) ? binderMaterialChecksum(buffer) : null)
      const fileSize = Number(material.file_size) || (buffer?.length ?? 0)
      totalBytes += fileSize

      const fileInsert = await safeQuery(
        client,
        `
        INSERT INTO personal_binder_ga_share_files (
          share_id, ga_id, object_key, material_title, original_file_name,
          mime_type, file_size, page_count, checksum_sha256,
          source_material_id, source_file_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
        `,
        [
          shareId,
          scope.gaId,
          destKey,
          material.material_title,
          material.original_file_name,
          mimeType,
          fileSize,
          material.page_count,
          checksum,
          materialId,
          material.file_id,
        ],
      )
      materialToShareFile.set(materialId, Number(fileInsert.rows[0].id))
    }

    for (const section of detail.sections) {
      const sectionInsert = await safeQuery(
        client,
        `
        INSERT INTO personal_binder_ga_share_sections (share_id, ga_id, title, sort_order)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        `,
        [shareId, scope.gaId, section.title, section.sortOrder],
      )
      const shareSectionId = Number(sectionInsert.rows[0].id)
      for (const item of section.items) {
        const materialId = Number(item.materialId)
        const shareFileId = materialToShareFile.get(materialId)
        if (!shareFileId) {
          throw Object.assign(new Error('공유 스냅샷 구성이 올바르지 않습니다.'), {
            httpStatus: 500,
          })
        }
        await safeQuery(
          client,
          `
          INSERT INTO personal_binder_ga_share_items (
            share_section_id, share_file_id, ga_id, sort_order, page_selection
          )
          VALUES ($1, $2, $3, $4, $5::jsonb)
          `,
          [
            shareSectionId,
            shareFileId,
            scope.gaId,
            item.sortOrder,
            // NULL(전체 페이지)은 SQL NULL로 저장해야 한다. JSON.stringify(null) = jsonb 'null'은
            // personal_binder_ga_share_item_pages_check(NULL 또는 array)를 위반한다(23514).
            serializeSharePageSelection(item.pageSelection),
          ],
        )
      }
    }

    await assertR2ObjectsExist(stagedObjectKeys)

    await safeQuery(
      client,
      `
      UPDATE personal_binder_ga_shares
      SET total_bytes = $1,
          file_count = $2,
          section_count = $3,
          status = 'active'
      WHERE id = $4 AND ga_id = $5
      `,
      [totalBytes, materialToShareFile.size, detail.sections.length, shareId, scope.gaId],
    )

    await client.query('COMMIT')
    return await loadSharedBinderDetail(pool, scope, shareId)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    await compensateR2ObjectKeys(stagedObjectKeys, {
      executor: pool,
      reason: 'share_create_failed',
      shareId,
      userId: scope.userId,
      gaId: scope.gaId,
    })
    throw error
  } finally {
    client.release()
  }
}

export async function readSharedBinderFileBuffer(pool, scope, shareId, shareFileId) {
  await assertActiveShareAccess(pool, shareId, scope)
  const result = await safeQuery(
    pool,
    `
    SELECT object_key, mime_type, original_file_name
    FROM personal_binder_ga_share_files
    WHERE id = $1 AND share_id = $2 AND ga_id = $3
    LIMIT 1
    `,
    [shareFileId, shareId, scope.gaId],
  )
  const row = result.rows[0]
  if (!row) {
    throw Object.assign(new Error('공유 파일을 찾을 수 없습니다.'), { httpStatus: 404 })
  }
  const buffer = await consentGetBuffer(String(row.object_key))
  if (!buffer?.length) {
    throw Object.assign(new Error('공유 파일을 읽을 수 없습니다.'), { httpStatus: 404 })
  }
  return {
    buffer,
    mimeType: row.mime_type,
    originalFileName: row.original_file_name,
  }
}
