type TodoActivity = {
  id: string
  createdAt?: string | null
  updatedAt?: string | null
}

function activityMs(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

/** 작성 시각과 수정 시각 중 더 최근 값. 둘 다 없으면 맨 뒤. */
export function todoRecentActivityMs(todo: Pick<TodoActivity, 'createdAt' | 'updatedAt'>): number {
  const times = [activityMs(todo.createdAt), activityMs(todo.updatedAt)].filter(
    (value): value is number => value != null,
  )
  if (times.length === 0) return Number.NEGATIVE_INFINITY
  return Math.max(...times)
}

/** 할 일 목록 기본 정렬: 방금 만들거나 고친 항목이 먼저. */
export function sortTodosNewestActivityFirst<T extends TodoActivity>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const byActivity = todoRecentActivityMs(b) - todoRecentActivityMs(a)
    if (byActivity !== 0) return byActivity
    return b.id.localeCompare(a.id)
  })
}
