import { getR2PublicCdnBase } from '../lib/consentStorage.js'
import { readStorageFileBufferFromPath } from '../lib/storageFileObjectKey.js'
import { safeQuery } from '../utils/dbSafeQuery.js'
import { normalizeBinderMaterialMime } from './binderMaterialUtils.js'

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @param {number} gaId
 */
export async function loadUserTeamId(executor, userId, gaId) {
  const result = await safeQuery(
    executor,
    `
    SELECT team_id
    FROM users
    WHERE id = $1 AND ga_id = $2 AND is_deleted = false
    LIMIT 1
    `,
    [userId, gaId],
  )
  const teamId = result.rows[0]?.team_id
  return teamId != null ? String(teamId) : ''
}

export function teamAttachmentObjectKeyFromFileUrl(fileUrl) {
  const base = getR2PublicCdnBase().replace(/\/$/, '')
  const u = String(fileUrl ?? '').trim()
  if (!u) return ''
  if (u.startsWith(`${base}/`)) {
    return u.slice(base.length + 1)
  }
  if (u.startsWith(base)) {
    return u.slice(base.length).replace(/^\//, '')
  }
  return ''
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ userId: string, gaId: number, teamId: string }} scope
 * @param {number} attachmentId
 */
export async function loadAccessibleTeamAttachment(executor, scope, attachmentId) {
  const result = await safeQuery(
    executor,
    `
    SELECT
      a.id,
      a.file_url,
      a.file_name,
      p.team_id,
      p.ga_id
    FROM team_post_attachments a
    INNER JOIN team_posts p ON p.id = a.post_id
    WHERE a.id = $1
      AND p.ga_id = $2
      AND COALESCE(p.is_deleted, false) = false
    LIMIT 1
    `,
    [attachmentId, scope.gaId],
  )
  const row = result.rows[0]
  if (!row) {
    throw Object.assign(new Error('팀 자료를 찾을 수 없습니다.'), { httpStatus: 404 })
  }
  if (String(row.team_id ?? '') !== String(scope.teamId ?? '')) {
    throw Object.assign(new Error('팀 자료에 접근할 수 없습니다.'), { httpStatus: 403 })
  }
  const objectKey = teamAttachmentObjectKeyFromFileUrl(row.file_url)
  if (!objectKey) {
    throw Object.assign(new Error('팀 자료 경로를 확인할 수 없습니다.'), { httpStatus: 409 })
  }
  const buffer = await readStorageFileBufferFromPath(objectKey)
  if (!buffer?.length) {
    throw Object.assign(new Error('팀 자료 파일을 읽을 수 없습니다.'), { httpStatus: 404 })
  }
  const fileName = String(row.file_name ?? 'team-file')
  const mimeType = normalizeBinderMaterialMime('', fileName)
  return { row, objectKey, buffer, mimeType, fileName }
}

/**
 * 동일 R2 object 를 가리키는 사용자 files 행을 찾거나 참조용으로 만든다. 객체 복사는 하지 않는다.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ userId: string, gaId: number }} scope
 * @param {string} objectKey
 * @param {string} originalName
 * @param {string} mimeType
 * @param {number} fileSize
 */
export async function findOrCreatePersonalFileReference(executor, scope, objectKey, originalName, mimeType, fileSize) {
  const existing = await safeQuery(
    executor,
    `
    SELECT id, original_name, display_name, file_path, file_size, mime_type
    FROM files
    WHERE user_id = $1
      AND ga_id = $2
      AND file_path = $3
      AND customer_id IS NULL
      AND deleted_at IS NULL
      AND status = 'active'
    LIMIT 1
    `,
    [scope.userId, scope.gaId, objectKey],
  )
  if (existing.rowCount > 0) {
    return existing.rows[0]
  }
  const ins = await safeQuery(
    executor,
    `
    INSERT INTO files (
      user_id, ga_id, customer_id, team_id, folder_id,
      original_name, display_name, file_path, file_size, mime_type,
      content, is_confirmed, status, created_at
    )
    VALUES ($1, $2, NULL, NULL, NULL, $3, $4, $5, $6, $7, '', true, 'active', NOW())
    RETURNING id, original_name, display_name, file_path, file_size, mime_type
    `,
    [scope.userId, scope.gaId, originalName, originalName, objectKey, fileSize, mimeType],
  )
  return ins.rows[0]
}
