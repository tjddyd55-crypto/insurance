import type { StorageFileBinderDeleteImpact } from '../api/storageApi'

const BINDER_LIST_LIMIT = 8

export function hasStorageBinderDeleteImpact(
  impact: StorageFileBinderDeleteImpact | null | undefined,
): boolean {
  return (impact?.binderItemCount ?? 0) > 0
}

export function buildStorageBinderDeleteImpactDescription(
  impact: StorageFileBinderDeleteImpact,
): string {
  return `이 자료는 현재 ${impact.binderCount}개의 바인더에서 사용 중입니다.`
}

/** StorageDeleteDialog detailLines — 순서·문구 SSOT */
export function buildStorageBinderDeleteImpactDetailLines(
  impact: StorageFileBinderDeleteImpact,
): string[] {
  if (!hasStorageBinderDeleteImpact(impact)) {
    return []
  }
  const lines = [
    '이 자료는 현재 바인더에서 사용 중입니다.',
    buildStorageBinderDeleteImpactDescription(impact),
    '사용 바인더:',
  ]
  for (const binder of impact.binders.slice(0, BINDER_LIST_LIMIT)) {
    const suffix = binder.itemCount > 1 ? ` (${binder.itemCount}항목)` : ''
    lines.push(`· ${binder.title}${suffix}`)
  }
  if (impact.binders.length > BINDER_LIST_LIMIT) {
    lines.push(`· 외 ${impact.binders.length - BINDER_LIST_LIMIT}개 바인더`)
  }
  lines.push('삭제하면 해당 바인더에서 자료가 제거될 수 있습니다.')
  lines.push('그래도 삭제하시겠습니까?')
  return lines
}

/** useConfirmDialog message (줄바꿈) */
export function buildStorageBinderDeleteImpactConfirmMessage(
  impact: StorageFileBinderDeleteImpact,
  fileLabel: string,
): string {
  if (!hasStorageBinderDeleteImpact(impact)) {
    return `"${fileLabel}" 파일을 삭제할까요?`
  }
  const binderLines = impact.binders
    .slice(0, BINDER_LIST_LIMIT)
    .map((binder) => `· ${binder.title}`)
    .join('\n')
  const overflow =
    impact.binders.length > BINDER_LIST_LIMIT
      ? `\n· 외 ${impact.binders.length - BINDER_LIST_LIMIT}개 바인더`
      : ''
  return [
    '이 자료는 현재 바인더에서 사용 중입니다.',
    buildStorageBinderDeleteImpactDescription(impact),
    '',
    '사용 바인더:',
    binderLines + overflow,
    '',
    '삭제하면 해당 바인더에서 자료가 제거될 수 있습니다.',
    '그래도 삭제하시겠습니까?',
  ].join('\n')
}
