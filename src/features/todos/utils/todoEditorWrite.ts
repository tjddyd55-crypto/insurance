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

/**
 * 할 일 저장의 날짜·시각.
 * 새 할 일은 dueTime null. 수정은 날짜가 남아 있으면 열 때 저장해 둔 dueTime 을 유지한다.
 * 날짜를 비우면 dueDate·dueTime 모두 null. 화면에는 시간 칸을 두지 않는다.
 */
export function todoEditorDatePayload(input: {
  mode: 'create' | 'edit'
  dueDate: string
  savedDueTime?: string | null
}): { dueDate: string | null; dueTime: string | null } {
  const dueDate = input.dueDate.trim()
  if (!dueDate) return { dueDate: null, dueTime: null }
  if (input.mode === 'create') return { dueDate, dueTime: null }
  const savedDueTime = input.savedDueTime?.trim() || null
  return { dueDate, dueTime: savedDueTime }
}
