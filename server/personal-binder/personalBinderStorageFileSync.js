import { safeQuery } from '../utils/dbSafeQuery.js'

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ userId: string, gaId: number }} scope
 * @param {number} fileId
 */
export async function getPersonalStorageFileBinderDeleteImpact(executor, scope, fileId) {
  const materials = await safeQuery(
    executor,
    `
    SELECT m.id, m.title
    FROM personal_binder_materials m
    WHERE m.file_id = $1
      AND m.owner_user_id = $2
      AND m.ga_id = $3
      AND m.deleted_at IS NULL
    `,
    [fileId, scope.userId, scope.gaId],
  )
  const materialIds = materials.rows.map((row) => Number(row.id))
  if (materialIds.length === 0) {
    return {
      materialCount: 0,
      binderCount: 0,
      binderItemCount: 0,
      binders: [],
      materials: [],
    }
  }
  const usage = await safeQuery(
    executor,
    `
    SELECT DISTINCT b.id, b.title, COUNT(i.id)::int AS item_count
    FROM personal_binder_items i
    INNER JOIN personal_binder_sections s ON s.id = i.section_id
    INNER JOIN personal_binders b ON b.id = s.binder_id AND b.deleted_at IS NULL
    WHERE i.material_id = ANY($1::bigint[])
    GROUP BY b.id, b.title
    ORDER BY b.title ASC
    `,
    [materialIds],
  )
  const itemCount = usage.rows.reduce((sum, row) => sum + Number(row.item_count ?? 0), 0)
  return {
    materialCount: materialIds.length,
    binderCount: usage.rows.length,
    binderItemCount: itemCount,
    binders: usage.rows.map((row) => ({
      id: String(row.id),
      title: String(row.title ?? ''),
      itemCount: Number(row.item_count ?? 0),
    })),
    materials: materials.rows.map((row) => ({
      id: String(row.id),
      title: String(row.title ?? ''),
    })),
  }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string, gaId: number }} scope
 * @param {number} fileId
 */
export async function cleanupPersonalBinderRefsForDeletedStorageFile(client, scope, fileId) {
  const materials = await safeQuery(
    client,
    `
    SELECT id FROM personal_binder_materials
    WHERE file_id = $1
      AND owner_user_id = $2
      AND ga_id = $3
      AND deleted_at IS NULL
    `,
    [fileId, scope.userId, scope.gaId],
  )
  const materialIds = materials.rows.map((row) => Number(row.id))
  if (materialIds.length === 0) {
    return { removedItems: 0, removedMaterials: 0 }
  }
  const deletedItems = await safeQuery(
    client,
    `
    DELETE FROM personal_binder_items i
    USING personal_binder_materials m
    WHERE i.material_id = m.id
      AND m.id = ANY($1::bigint[])
      AND m.owner_user_id = $2
      AND m.ga_id = $3
    `,
    [materialIds, scope.userId, scope.gaId],
  )
  const removedMaterials = await safeQuery(
    client,
    `
    UPDATE personal_binder_materials
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = ANY($1::bigint[])
      AND owner_user_id = $2
      AND ga_id = $3
      AND deleted_at IS NULL
    `,
    [materialIds, scope.userId, scope.gaId],
  )
  return {
    removedItems: deletedItems.rowCount ?? 0,
    removedMaterials: removedMaterials.rowCount ?? 0,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ userId: string, gaId: number }} scope
 */
export async function softDeleteOrphanPersonalBinderMaterials(executor, scope) {
  const result = await safeQuery(
    executor,
    `
    UPDATE personal_binder_materials m
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE m.owner_user_id = $1
      AND m.ga_id = $2
      AND m.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM files f
        WHERE f.id = m.file_id
          AND f.user_id = $1
          AND f.ga_id = $2
          AND f.deleted_at IS NULL
          AND f.status = 'active'
      )
    `,
    [scope.userId, scope.gaId],
  )
  return result.rowCount ?? 0
}
