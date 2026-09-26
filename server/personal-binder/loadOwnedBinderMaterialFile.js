import { safeQuery } from '../utils/dbSafeQuery.js'

export async function loadOwnedBinderMaterialFile(executor, materialId, scope) {
  const result = await safeQuery(
    executor,
    `
    SELECT
      m.id,
      m.file_id,
      m.page_count,
      m.checksum_sha256,
      m.mime_type AS material_mime,
      f.file_path,
      f.mime_type AS file_mime,
      f.file_size
    FROM personal_binder_materials m
    INNER JOIN files f ON f.id = m.file_id
    WHERE m.id = $1
      AND m.owner_user_id = $2
      AND m.ga_id = $3
      AND m.deleted_at IS NULL
      AND f.user_id = $2
      AND f.ga_id = $3
      AND f.customer_id IS NULL
      AND f.status = 'active'
      AND f.deleted_at IS NULL
    LIMIT 1
    `,
    [materialId, scope.userId, scope.gaId],
  )
  return result.rows[0] ?? null
}
