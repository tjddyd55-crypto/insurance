/** Reuse single deletion, sequentially: bounded load and independent per-file failures. */
export async function deleteStorageFileBatch(fileIds, removeBinderReferences, deleteOne) {
  if (!Array.isArray(fileIds) || fileIds.length < 1 || fileIds.length > 100 ||
      fileIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    throw Object.assign(new Error('파일 ID를 1개 이상 100개 이하로 지정해 주세요.'), { httpStatus: 400 })
  }
  const deleted = []
  const failed = []
  for (const id of new Set(fileIds)) {
    try {
      const result = await deleteOne(id, removeBinderReferences === true)
      if (result.status >= 200 && result.status < 300) deleted.push(id)
      else failed.push({ id, reason: result.status === 404 ? 'NOT_FOUND' :
        ['BINDER_FILE_IN_USE', 'BINDER_IMPACT_CHANGED'].includes(result.body?.code) ? 'USED_IN_BINDER' : 'INTERNAL' })
    } catch {
      failed.push({ id, reason: 'INTERNAL' })
    }
  }
  return { deleted, failed }
}
