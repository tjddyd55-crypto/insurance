/** Inherited names follow files; unknown legacy names remain custom conservatively. */
export function resolveBinderMaterialTitle(row) {
  if (row.custom_title != null) return row.custom_title
  const title = String(row.title ?? row.material_title ?? '')
  const originalStem = String(row.original_file_name ?? '').replace(/\.[^.]+$/, '')
  const inherited = !title || title === row.original_file_name || title === originalStem || title === row.source_display_name
  return inherited
    ? String(row.file_display_name || row.file_original_name || title || row.original_file_name || '')
    : title
}

export async function resolveBinderMaterialRows(executor, rows, scope) {
  if (!rows.length) return rows
  const result = await executor.query(`
    SELECT id, display_name, original_name FROM files
    WHERE id = ANY($1::bigint[]) AND user_id = $2 AND ga_id = $3
      AND deleted_at IS NULL AND status = 'active'
  `, [rows.map((row) => Number(row.file_id)), scope.userId, scope.gaId])
  const files = new Map(result.rows.map((file) => [String(file.id), file]))
  return rows.map((row) => {
    const file = files.get(String(row.file_id))
    return { ...row, title: resolveBinderMaterialTitle({ ...row,
      file_display_name: file?.display_name, file_original_name: file?.original_name,
    }) }
  })
}
