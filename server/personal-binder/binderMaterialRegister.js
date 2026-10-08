import { consentPutObject } from '../lib/consentStorage.js'
import {
  INSURANCE_STORAGE_CATEGORY,
  buildInsuranceUserStorageKey,
  normalizeInsuranceGaCode,
} from '../lib/insuranceStorageLayout.js'
import { readStorageFileBufferFromPath } from '../lib/storageFileObjectKey.js'
import { sanitizeStorageFileNameForObjectKey } from '../lib/storageFileNameValidation.js'
import { safeQuery } from '../utils/dbSafeQuery.js'
import {
  binderMaterialChecksum,
  normalizeBinderMaterialMime,
  resolveBinderMaterialPageCount,
} from './binderMaterialUtils.js'

const PERSONAL_FILE_MAX_BYTES = 25 * 1024 * 1024

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ userId: string, gaId: number }} scope
 * @param {number} fileId
 */
export async function loadOwnedPersonalStorageFile(executor, scope, fileId) {
  const result = await safeQuery(
    executor,
    `
    SELECT id, original_name, display_name, file_path, file_size, mime_type
    FROM files
    WHERE id = $1
      AND user_id = $2
      AND ga_id = $3
      AND customer_id IS NULL
      AND team_id IS NULL
      AND status = 'active'
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [fileId, scope.userId, scope.gaId],
  )
  return result.rows[0] ?? null
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ userId: string, gaId: number }} scope
 * @param {number} fileId
 */
export async function readOwnedPersonalStorageFileBuffer(executor, scope, fileId) {
  const file = await loadOwnedPersonalStorageFile(executor, scope, fileId)
  if (!file) {
    throw Object.assign(new Error('파일을 찾을 수 없습니다.'), { httpStatus: 404 })
  }
  const objectKey = String(file.file_path ?? '').trim()
  const buffer = await readStorageFileBufferFromPath(objectKey)
  if (!buffer?.length) {
    throw Object.assign(new Error('파일을 읽을 수 없습니다.'), { httpStatus: 404 })
  }
  const mimeType = normalizeBinderMaterialMime(file.mime_type, file.original_name ?? file.display_name)
  return { file, buffer, mimeType }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ userId: string, gaId: number }} scope
 * @param {object} input
 */
export async function insertPersonalBinderMaterial(executor, scope, input) {
  const {
    fileId,
    title,
    originalFileName,
    mimeType,
    fileSize,
    pageCount,
    checksum,
    folderId,
    sourceType = 'personal',
    sourceRef = null,
  } = input
  const insert = await safeQuery(
    executor,
    `
    INSERT INTO personal_binder_materials (
      owner_user_id, ga_id, folder_id, file_id, title, original_file_name,
      mime_type, file_size, page_count, checksum_sha256, source_type, source_ref
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *, 0::int AS binder_count
    `,
    [
      scope.userId,
      scope.gaId,
      folderId,
      fileId,
      title,
      originalFileName,
      mimeType,
      fileSize,
      pageCount,
      checksum,
      sourceType,
      sourceRef,
    ],
  )
  return insert.rows[0]
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ userId: string, gaId: number }} scope
 * @param {object} fileRow files 테이블 행
 * @param {object} options
 */
export async function registerBinderMaterialFromStorageFile(executor, scope, fileRow, options) {
  const objectKey = String(fileRow.file_path ?? '').trim()
  const buffer = await readStorageFileBufferFromPath(objectKey)
  const originalName = String(fileRow.original_name ?? fileRow.display_name ?? '')
  const mimeType = normalizeBinderMaterialMime(fileRow.mime_type, originalName)
  const pageCount = await resolveBinderMaterialPageCount(buffer, mimeType)
  const checksum = binderMaterialChecksum(buffer)
  const duplicate = await safeQuery(
    executor,
    `
    SELECT id FROM personal_binder_materials
    WHERE owner_user_id = $1 AND ga_id = $2 AND checksum_sha256 = $3 AND deleted_at IS NULL
    LIMIT 1
    `,
    [scope.userId, scope.gaId, checksum],
  )
  if (duplicate.rowCount > 0) {
    throw Object.assign(
      new Error('이미 자료 보관함에 등록된 파일입니다.'),
      { httpStatus: 409, code: 'DUPLICATE_MATERIAL', materialId: String(duplicate.rows[0].id) },
    )
  }
  return insertPersonalBinderMaterial(executor, scope, {
    fileId: Number(fileRow.id),
    title: options.title,
    originalFileName: originalName,
    mimeType,
    fileSize: Number(fileRow.file_size) || buffer.length,
    pageCount,
    checksum,
    folderId: options.folderId ?? null,
    sourceType: options.sourceType ?? 'personal',
    sourceRef: options.sourceRef ?? null,
  })
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ userId: string, gaId: number }} scope
 * @param {string} gaCodeRaw
 * @param {Buffer} buffer
 * @param {string} displayFileName
 */
export async function persistPersonalStoragePdf(pool, scope, gaCodeRaw, buffer, displayFileName) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 1) {
    throw Object.assign(new Error('PDF 데이터가 비어 있습니다.'), { httpStatus: 400 })
  }
  if (buffer.length > PERSONAL_FILE_MAX_BYTES) {
    throw Object.assign(new Error('PDF 파일이 너무 큽니다.'), { httpStatus: 400 })
  }
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw Object.assign(new Error('PDF 형식이 올바르지 않습니다.'), { httpStatus: 400 })
  }
  const gaCode = normalizeInsuranceGaCode(gaCodeRaw) || String(scope.gaId)
  const safeName = sanitizeStorageFileNameForObjectKey(displayFileName)
  const objectKey = buildInsuranceUserStorageKey({
    gaCode,
    userId: scope.userId,
    category: INSURANCE_STORAGE_CATEGORY.PERSONAL_FILES,
    originalName: safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`,
  })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
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
    if (!Number.isFinite(used) || !Number.isFinite(limit) || used + buffer.length > limit) {
      throw Object.assign(new Error('저장 공간 한도를 초과했습니다.'), { httpStatus: 400 })
    }
    const originalName = String(displayFileName ?? '').trim() || 'material.pdf'
    const ins = await safeQuery(
      client,
      `
      INSERT INTO files (
        user_id, ga_id, customer_id, team_id, folder_id,
        original_name, display_name, file_path, file_size, mime_type,
        content, is_confirmed, status, created_at
      )
      VALUES ($1, $2, NULL, NULL, NULL, $3, $4, $5, $6, 'application/pdf', '', true, 'uploading', NOW())
      RETURNING id
      `,
      [scope.userId, scope.gaId, originalName, originalName, objectKey, buffer.length],
    )
    const fileId = Number(ins.rows[0].id)
    await consentPutObject(objectKey, buffer, 'application/pdf')
    await safeQuery(
      client,
      `
      UPDATE files
      SET status = 'active', is_confirmed = true
      WHERE id = $1 AND user_id = $2 AND ga_id = $3
      `,
      [fileId, scope.userId, scope.gaId],
    )
    await safeQuery(
      client,
      `
      UPDATE users SET storage_used = storage_used + $1 WHERE id = $2 AND ga_id = $3
      `,
      [buffer.length, scope.userId, scope.gaId],
    )
    await client.query('COMMIT')
    const fileRow = await loadOwnedPersonalStorageFile(pool, scope, fileId)
    if (!fileRow) {
      throw Object.assign(new Error('파일을 저장하지 못했습니다.'), { httpStatus: 500 })
    }
    return fileRow
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
