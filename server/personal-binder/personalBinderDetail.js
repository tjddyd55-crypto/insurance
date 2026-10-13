import { safeQuery } from '../utils/dbSafeQuery.js'

async function getOwnedBinder(executor, binderId, scope) {
  const result = await safeQuery(
    executor,
    `
    SELECT id, title, description, folder_id, created_at, updated_at
    FROM personal_binders
    WHERE id = $1 AND owner_user_id = $2 AND ga_id = $3 AND deleted_at IS NULL
    LIMIT 1
    `,
    [binderId, scope.userId, scope.gaId],
  )
  return result.rows[0] ?? null
}

export async function loadBinderDetail(executor, binderId, scope) {
  const binder = await getOwnedBinder(executor, binderId, scope)
  if (!binder) return null
  const sections = await executor.query(
    `
    SELECT id, title, sort_order, created_at, updated_at
    FROM personal_binder_sections
    WHERE binder_id = $1
    ORDER BY sort_order ASC, id ASC
    `,
    [binderId],
  )
  const items = await executor.query(
    `
    SELECT
      i.id,
      i.section_id,
      i.material_id,
      i.sort_order,
      i.page_selection,
      i.created_at,
      i.updated_at,
      m.file_id,
      m.title AS material_title,
      m.original_file_name,
      m.mime_type,
      m.file_size,
      m.page_count
    FROM personal_binder_items i
    INNER JOIN personal_binder_sections s ON s.id = i.section_id
    INNER JOIN personal_binder_materials m ON m.id = i.material_id
    WHERE s.binder_id = $1 AND m.deleted_at IS NULL
    ORDER BY s.sort_order ASC, i.sort_order ASC, i.id ASC
    `,
    [binderId],
  )
  const bySection = new Map()
  for (const item of items.rows) {
    const key = String(item.section_id)
    const rows = bySection.get(key) ?? []
    rows.push({
      id: String(item.id),
      sectionId: key,
      materialId: String(item.material_id),
      sortOrder: Number(item.sort_order),
      pageSelection: item.page_selection,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      material: {
        id: String(item.material_id),
        fileId: Number(item.file_id),
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
    id: String(binder.id),
    title: binder.title,
    description: binder.description,
    createdAt: binder.created_at,
    updatedAt: binder.updated_at,
    sections: sections.rows.map((section) => ({
      id: String(section.id),
      binderId: String(binder.id),
      title: section.title,
      sortOrder: Number(section.sort_order),
      createdAt: section.created_at,
      updatedAt: section.updated_at,
      items: bySection.get(String(section.id)) ?? [],
    })),
  }
}
