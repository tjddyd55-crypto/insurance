export function toggleStorageSelection(ids: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(ids)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function retainFailedSelection(ids: ReadonlySet<number>, deleted: number[]): Set<number> {
  const removed = new Set(deleted)
  return new Set([...ids].filter((id) => !removed.has(id)))
}

export function storageBatchDeleteSummary(deleted: number, failed: number): string {
  return failed === 0 ? `${deleted}개 삭제 완료` : `${deleted}개 삭제 완료 / ${failed}개 삭제 실패`
}
