export type TodosViewMode = 'list' | 'calendar'

const PREFIX = 'insurance.todos.ui.v1'

function key(userId: string): string {
  return `${PREFIX}.${userId.trim() || 'anonymous'}`
}

export function readTodosViewMode(userId: string): TodosViewMode {
  if (typeof window === 'undefined') return 'list'
  try {
    const value = window.localStorage.getItem(key(userId))
    return value === 'calendar' ? 'calendar' : 'list'
  } catch {
    return 'list'
  }
}

export function writeTodosViewMode(userId: string, mode: TodosViewMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key(userId), mode)
  } catch {
    // 브라우저 저장소가 차단돼도 현재 세션의 보기 전환은 유지한다.
  }
}
