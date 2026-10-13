import { loadBinderDetail } from './personalBinderDetail.js'
import {
  INSURANCE_STORAGE_CATEGORY,
  buildInsuranceUserStorageKey,
  normalizeInsuranceGaCode,
} from '../lib/insuranceStorageLayout.js'
import { sanitizeStorageFileNameForObjectKey } from '../lib/storageFileNameValidation.js'
import { safeQuery } from '../utils/dbSafeQuery.js'
import {
  binderMaterialChecksum,
  normalizeBinderMaterialMime,
  resolveBinderMaterialPageCount,
} from './binderMaterialUtils.js'
import { insertPersonalBinderMaterial } from './binderMaterialRegister.js'
import { ensureImportFolderPath } from './personalBinderShareFolders.js'
import { copyR2ObjectForBinderShare } from './personalBinderShareR2.js'
import {
  assertR2ObjectsExist,
  compensateR2ObjectKeys,
  normalizeObjectKeyList,
} from './personalBinderShareR2Compensation.js'
import { consentGetBuffer } from '../lib/consentStorage.js'

async function loadShareForImport(client, shareId, scope) {
  const result = await safeQuery(
    client,
    `
    SELECT id, status, ga_id, title, description, total_bytes
    FROM personal_binder_ga_shares
    WHERE id = $1 AND ga_id = $2
    LIMIT 1
    FOR UPDATE
    `,
    [shareId, scope.gaId],
  )
  const row = result.rows[0]
  if (!row) {
    throw Object.assign(new Error('공유 바인더를 찾을 수 없습니다.'), { httpStatus: 404 })
  }
  if (row.status !== 'active') {
    throw Object.assign(new Error('가져올 수 있는 공유 바인더가 아닙니다.'), { httpStatus: 404 })
  }
  return row
}

async function loadShareSnapshotInTransaction(client, shareId, gaId) {
  const sections = await safeQuery(
    client,
    `
    SELECT id, title, sort_order
    FROM personal_binder_ga_share_sections
    WHERE share_id = $1 AND ga_id = $2
    ORDER BY sort_order ASC, id ASC
    `,
    [shareId, gaId],
  )
  const items = await safeQuery(
    client,
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
    [shareId, gaId],
  )
  const shareFiles = await safeQuery(
    client,
    `
    SELECT id, object_key, material_title, original_file_name, mime_type, file_size, page_count, checksum_sha256
    FROM personal_binder_ga_share_files
    WHERE share_id = $1 AND ga_id = $2
    ORDER BY id ASC
    `,
    [shareId, gaId],
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
    title: '',
    description: '',
    sections: sections.rows.map((section) => ({
      id: String(section.id),
      title: section.title,
      sortOrder: Number(section.sort_order),
      items: bySection.get(String(section.id)) ?? [],
    })),
    shareFiles: shareFiles.rows,
  }
}

async function findImportJob(executor, scope, idempotencyKey) {
  const result = await safeQuery(
    executor,
    `
    SELECT id, status, target_binder_id, share_id, staged_object_keys
    FROM personal_binder_ga_share_import_jobs
    WHERE importer_user_id = $1 AND ga_id = $2 AND idempotency_key = $3
    LIMIT 1
    `,
    [scope.userId, scope.gaId, idempotencyKey],
  )
  return result.rows[0] ?? null
}

async function reserveStorageBytes(client, scope, requiredBytes) {
  const quota = await safeQuery(
    client,
    `
    SELECT storage_used, storage_limit
    FROM users
    WHERE id = $1 AND ga_id = $2
    FOR UPDATE
    `,
    [scope.userId, scope.gaId],
  )
  if (quota.rowCount === 0) {
    throw Object.assign(new Error('사용자 정보를 확인할 수 없습니다.'), { httpStatus: 400 })
  }
  const used = Number(quota.rows[0].storage_used)
  const limit = Number(quota.rows[0].storage_limit)
  if (!Number.isFinite(used) || !Number.isFinite(limit) || used + requiredBytes > limit) {
    throw Object.assign(new Error('저장 공간이 부족합니다.'), { httpStatus: 400, code: 'STORAGE_QUOTA' })
  }
  if (requiredBytes > 0) {
    await safeQuery(
      client,
      `
      UPDATE users SET storage_used = storage_used + $1 WHERE id = $2 AND ga_id = $3
      `,
      [requiredBytes, scope.userId, scope.gaId],
    )
  }
}

async function insertPersonalFileFromShareCopy(
  client,
  scope,
  folderId,
  shareFileRow,
  objectKey,
  buffer,
) {
  const mimeType = normalizeBinderMaterialMime(shareFileRow.mime_type, shareFileRow.original_file_name)
  const originalName = String(shareFileRow.original_file_name ?? '').trim() || 'file'
  const fileSize = buffer.length
  const ins = await safeQuery(
    client,
    `
    INSERT INTO files (
      user_id, ga_id, customer_id, team_id, folder_id,
      original_name, display_name, file_path, file_size, mime_type,
      content, is_confirmed, status, created_at
    )
    VALUES ($1, $2, NULL, NULL, $3, $4, $5, $6, $7, $8, '', true, 'active', NOW())
    RETURNING id
    `,
    [
      scope.userId,
      scope.gaId,
      folderId,
      originalName,
      originalName,
      objectKey,
      fileSize,
      mimeType,
    ],
  )
  return Number(ins.rows[0].id)
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ userId: string, gaId: number }} scope
 * @param {string} gaCode
 * @param {number} shareId
 * @param {string} idempotencyKey
 */
export async function importSharedPersonalBinder(pool, scope, gaCode, shareId, idempotencyKey) {
  const key = String(idempotencyKey ?? '').trim()
  if (!key || key.length > 128) {
    throw Object.assign(new Error('요청 키가 올바르지 않습니다.'), { httpStatus: 400 })
  }

  const existingJob = await findImportJob(pool, scope, key)
  if (existingJob?.status === 'completed' && existingJob.target_binder_id) {
    const detail = await loadBinderDetail(pool, Number(existingJob.target_binder_id), scope)
    if (detail) {
      return { binder: detail, reused: true }
    }
  }
  if (existingJob?.status === 'running' || existingJob?.status === 'pending') {
    throw Object.assign(new Error('가져오기가 이미 진행 중입니다.'), { httpStatus: 409 })
  }
  if (existingJob?.status === 'failed') {
    const orphanKeys = normalizeObjectKeyList(existingJob.staged_object_keys)
    if (orphanKeys.length > 0) {
      await compensateR2ObjectKeys(orphanKeys, {
        executor: pool,
        reason: 'import_retry_cleanup',
        importJobId: Number(existingJob.id),
        userId: scope.userId,
        gaId: scope.gaId,
      })
    }
    await safeQuery(
      pool,
      `
      UPDATE personal_binder_ga_share_import_jobs
      SET status = 'pending',
          error_message = NULL,
          updated_at = NOW(),
          target_binder_id = NULL,
          staged_object_keys = '[]'::jsonb,
          reserved_bytes = 0,
          copied_share_files = '{}'::jsonb
      WHERE id = $1 AND ga_id = $2
      `,
      [existingJob.id, scope.gaId],
    )
  }

  const client = await pool.connect()
  const stagedObjectKeys = []
  let jobId = null

  try {
    await client.query('BEGIN')
    const shareRow = await loadShareForImport(client, shareId, scope)
    const snapshot = await loadShareSnapshotInTransaction(client, shareId, scope.gaId)
    snapshot.title = shareRow.title
    snapshot.description = shareRow.description

    const requiredBytes = snapshot.shareFiles.reduce(
      (sum, row) => sum + (Number(row.file_size) || 0),
      0,
    )
    await reserveStorageBytes(client, scope, requiredBytes)

    const jobInsert = await safeQuery(
      client,
      `
      INSERT INTO personal_binder_ga_share_import_jobs (
        share_id, importer_user_id, ga_id, idempotency_key, status, reserved_bytes
      )
      VALUES ($1, $2, $3, $4, 'running', $5)
      ON CONFLICT (importer_user_id, ga_id, idempotency_key)
      DO UPDATE SET
        status = 'running',
        updated_at = NOW(),
        reserved_bytes = EXCLUDED.reserved_bytes,
        share_id = EXCLUDED.share_id
      RETURNING id
      `,
      [shareId, scope.userId, scope.gaId, key, requiredBytes],
    )
    jobId = Number(jobInsert.rows[0].id)

    const importFolderId = await ensureImportFolderPath(client, scope, snapshot.title)
    const normalizedGa = normalizeInsuranceGaCode(gaCode) || String(scope.gaId)
    const shareFileIdToMaterial = new Map()

    for (const shareFile of snapshot.shareFiles) {
      const shareFileId = Number(shareFile.id)
      const sourceKey = String(shareFile.object_key ?? '').trim()
      const safeName = sanitizeStorageFileNameForObjectKey(shareFile.original_file_name)
      const destKey = buildInsuranceUserStorageKey({
        gaCode: normalizedGa,
        userId: scope.userId,
        category: INSURANCE_STORAGE_CATEGORY.PERSONAL_FILES,
        originalName: safeName,
      })
      await copyR2ObjectForBinderShare(sourceKey, destKey, shareFile.mime_type)
      stagedObjectKeys.push(destKey)
      await assertR2ObjectsExist([destKey])

      await safeQuery(
        client,
        `
        UPDATE personal_binder_ga_share_import_jobs
        SET staged_object_keys = $1::jsonb, updated_at = NOW()
        WHERE id = $2 AND ga_id = $3
        `,
        [JSON.stringify(stagedObjectKeys), jobId, scope.gaId],
      )

      const buffer = await consentGetBuffer(destKey)
      if (!buffer?.length) {
        throw Object.assign(new Error('파일 복사에 실패했습니다.'), { httpStatus: 500 })
      }
      const fileId = await insertPersonalFileFromShareCopy(
        client,
        scope,
        importFolderId,
        shareFile,
        destKey,
        buffer,
      )
      const pageCount = await resolveBinderMaterialPageCount(
        buffer,
        normalizeBinderMaterialMime(shareFile.mime_type, shareFile.original_file_name),
      )
      const checksum = shareFile.checksum_sha256 ?? binderMaterialChecksum(buffer)
      const materialRow = await insertPersonalBinderMaterial(client, scope, {
        fileId,
        title: shareFile.material_title,
        originalFileName: shareFile.original_file_name,
        mimeType: normalizeBinderMaterialMime(shareFile.mime_type, shareFile.original_file_name),
        fileSize: buffer.length,
        pageCount,
        checksum,
        folderId: null,
        sourceType: 'personal',
        sourceRef: `shared:${shareId}`,
      })
      shareFileIdToMaterial.set(shareFileId, Number(materialRow.id))
    }

    const binderTitle = String(snapshot.title ?? '').trim().slice(0, 200) || '가져온 바인더'
    const binderInsert = await safeQuery(
      client,
      `
      INSERT INTO personal_binders (owner_user_id, ga_id, folder_id, title, description)
      VALUES ($1, $2, NULL, $3, $4)
      RETURNING id
      `,
      [scope.userId, scope.gaId, binderTitle, snapshot.description ?? ''],
    )
    const newBinderId = Number(binderInsert.rows[0].id)

    for (const section of snapshot.sections) {
      const sectionInsert = await safeQuery(
        client,
        `
        INSERT INTO personal_binder_sections (binder_id, title, sort_order)
        VALUES ($1, $2, $3)
        RETURNING id
        `,
        [newBinderId, section.title, section.sortOrder],
      )
      const sectionId = Number(sectionInsert.rows[0].id)
      for (const item of section.items) {
        const materialId = shareFileIdToMaterial.get(Number(item.shareFileId))
        if (!materialId) {
          throw Object.assign(new Error('가져오기 구성이 올바르지 않습니다.'), { httpStatus: 500 })
        }
        await safeQuery(
          client,
          `
          INSERT INTO personal_binder_items (section_id, material_id, sort_order, page_selection)
          VALUES ($1, $2, $3, $4::jsonb)
          `,
          [
            sectionId,
            materialId,
            item.sortOrder,
            item.pageSelection != null ? JSON.stringify(item.pageSelection) : null,
          ],
        )
      }
    }

    await assertR2ObjectsExist(stagedObjectKeys)

    await safeQuery(
      client,
      `
      UPDATE personal_binder_ga_share_import_jobs
      SET status = 'completed',
          target_binder_id = $1,
          completed_at = NOW(),
          updated_at = NOW(),
          staged_object_keys = '[]'::jsonb
      WHERE id = $2 AND ga_id = $3
      `,
      [newBinderId, jobId, scope.gaId],
    )

    await client.query('COMMIT')
    const detail = await loadBinderDetail(pool, newBinderId, scope)
    return { binder: detail, reused: false }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    await compensateR2ObjectKeys(stagedObjectKeys, {
      executor: pool,
      reason: 'import_failed',
      shareId,
      importJobId: jobId,
      userId: scope.userId,
      gaId: scope.gaId,
    })
    await safeQuery(
      pool,
      `
      INSERT INTO personal_binder_ga_share_import_jobs (
        share_id, importer_user_id, ga_id, idempotency_key, status, error_message, staged_object_keys
      )
      VALUES ($1, $2, $3, $4, 'failed', $5, $6::jsonb)
      ON CONFLICT (importer_user_id, ga_id, idempotency_key)
      DO UPDATE SET
        status = 'failed',
        error_message = EXCLUDED.error_message,
        staged_object_keys = EXCLUDED.staged_object_keys,
        updated_at = NOW()
      `,
      [
        shareId,
        scope.userId,
        scope.gaId,
        key,
        String(error?.message ?? 'failed').slice(0, 500),
        JSON.stringify(stagedObjectKeys),
      ],
    ).catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
