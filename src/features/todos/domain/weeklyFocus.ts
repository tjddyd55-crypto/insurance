import type { TodoDto } from './todoTypes'

/** YYYY-MM-DD 달력일 + n일 (UTC 산술, 시간대 무관). */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** 해당 날짜(YYYY-MM-DD, Asia/Seoul 달력일)가 속한 주의 월요일. 주간 = 월~일. */
export function mondayOfYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=일
  return addDaysYmd(ymd, -((weekday + 6) % 7))
}

/** "11.02 ~ 11.08" */
export function formatWeekRangeLabel(weekStart: string): string {
  const end = addDaysYmd(weekStart, 6)
  const md = (v: string) => `${v.slice(5, 7)}.${v.slice(8, 10)}`
  return `${md(weekStart)} ~ ${md(end)}`
}

/** 그 주로 직접 지정(수동)인지. 아니면 그 주 예정일로 자동 포함. */
export function isManualWeeklyFocus(todo: Pick<TodoDto, 'weeklyFocusWeekStart'>, weekStart: string): boolean {
  return todo.weeklyFocusWeekStart === weekStart
}

/** 그 주 예정일이거나 직접 지정된 할 일인지(서버 GET weekStart 조건과 동일). */
export function belongsToWeek(todo: Pick<TodoDto, 'dueDate' | 'weeklyFocusWeekStart'>, weekStart: string): boolean {
  if (todo.weeklyFocusWeekStart === weekStart) return true
  const due = todo.dueDate?.slice(0, 10)
  return Boolean(due) && due! >= weekStart && due! <= addDaysYmd(weekStart, 6)
}

/** 드래그 데이터 타입 */
export const WEEKLY_DRAG_MIME = 'application/x-onefc-todo-id'
/** 주간 패널 → 전체 목록으로 되돌리는 드래그 */
export const WEEKLY_BACK_DRAG_MIME = 'application/x-onefc-weekly-todo-id'
