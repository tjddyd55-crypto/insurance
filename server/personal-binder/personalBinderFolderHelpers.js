export const PERSONAL_BINDER_FOLDER_TYPES = new Set(['material', 'binder'])

export function mapPersonalBinderFolder(row) {
  return {
    id: String(row.id),
    folderType: row.folder_type,
    name: row.name,
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getOwnedFolder(executor, folderId, scope, folderType) {
  const result = await executor.query(
    `
    SELECT id, folder_type, name, sort_order, created_at, updated_at
    FROM personal_binder_folders
    WHERE id = $1
      AND owner_user_id = $2
      AND ga_id = $3
      AND folder_type = $4
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [folderId, scope.userId, scope.gaId, folderType],
  )
  return result.rows[0] ?? null
}

export async function resolveFolderIdForWrite(executor, scope, folderType, rawFolderId) {
  if (rawFolderId == null || rawFolderId === '') {
    return null
  }
  const folderId = Number(rawFolderId)
  if (!Number.isInteger(folderId) || folderId < 1) {
    throw Object.assign(new Error('폴더를 찾을 수 없습니다.'), { httpStatus: 400 })
  }
  const folder = await getOwnedFolder(executor, folderId, scope, folderType)
  if (!folder) {
    throw Object.assign(new Error('폴더를 찾을 수 없습니다.'), { httpStatus: 404 })
  }
  return folderId
}
