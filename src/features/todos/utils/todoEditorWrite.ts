import { initialCreateDueDate } from './defaultTodoDueDate'

/**
 * 할 일 작성 창을 열 때의 날짜 칸.
 * 수정은 저장된 dueDate 그대로(빈 값이면 빈 칸, 오늘을 넣지 않는다).
 * 추가는 달력에서 고른 날, 없으면 오늘(Asia/Seoul).
 */
export function todoEditorDueDateForOpen(params: {
  mode: 'create' | 'edit'
  savedDueDate?: string | null
  explicit?: string | null
  now?: Date
}): string {
  if (params.mode === 'edit') return params.savedDueDate ?? ''
  return initialCreateDueDate({ explicit: params.explicit, now: params.now })
}

/** 저장 본문의 날짜. 시간 칸은 없고 dueTime 은 항상 null. */
export function todoEditorDatePayload(dueDate: string): { dueDate: string | null; dueTime: null } {
  const trimmed = dueDate.trim()
  return { dueDate: trimmed || null, dueTime: null }
}
