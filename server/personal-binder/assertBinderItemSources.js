/** Call with the write transaction's client; hold file locks through INSERT/COMMIT. */
export async function assertBinderItemSources(client, sectionId, materialIds, scope) {
  const ids = [...new Set(materialIds.map(Number))].sort((a, b) => a - b)
  if (!ids.length) return
  const result = await client.query(`
    SELECT m.id
    FROM files f
    JOIN personal_binder_materials m ON m.file_id = f.id
      AND m.owner_user_id = f.user_id AND m.ga_id = f.ga_id
    JOIN personal_binder_sections s ON s.id = $1
    JOIN personal_binders b ON b.id = s.binder_id
      AND b.owner_user_id = m.owner_user_id AND b.ga_id = m.ga_id
    WHERE m.id = ANY($2::bigint[])
      AND b.owner_user_id = $3 AND b.ga_id = $4 AND b.deleted_at IS NULL
      AND m.deleted_at IS NULL AND f.deleted_at IS NULL AND f.status = 'active'
    ORDER BY f.id, m.id
    FOR SHARE OF f
  `, [sectionId, ids, scope.userId, scope.gaId])
  const found = new Set(result.rows.map((row) => Number(row.id)))
  if (ids.some((id) => !found.has(id))) {
    throw Object.assign(new Error('원본 파일이 삭제되었거나 사용할 수 없습니다. 목록을 새로고침해 주세요.'), {
      httpStatus: 409,
      code: 'BINDER_SOURCE_UNAVAILABLE',
    })
  }
}
