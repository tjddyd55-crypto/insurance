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

/** 그 주 주간 할 일인지(서버 GET weekStart 조건과 동일: 그 주로 지정한 것만, 예정일 자동 포함 없음). */
export function belongsToWeek(todo: Pick<TodoDto, 'weeklyFocusWeekStart'>, weekStart: string): boolean {
  return todo.weeklyFocusWeekStart === weekStart
}

/** 주간 패널 정렬: 미완료 먼저, 완료는 뒤(각각 서버 순서 유지) */
export function sortWeeklyTodos<T extends Pick<TodoDto, 'status'>>(rows: T[]): T[] {
  return [...rows.filter((r) => r.status !== 'completed'), ...rows.filter((r) => r.status === 'completed')]
}

/** 드래그 데이터 타입 */
export const WEEKLY_DRAG_MIME = 'application/x-onefc-todo-id'
/** 주간 패널 → 전체 목록으로 되돌리는 드래그 */
export const WEEKLY_BACK_DRAG_MIME = 'application/x-onefc-weekly-todo-id'

/** 주 이동: weekStart(월) 기준 ±n주의 월요일 */
export function shiftWeekStart(weekStart: string, weeks: number): string {
  return addDaysYmd(mondayOfYmd(weekStart), weeks * 7)
}

/** 이전/다음 주로 이동: 지정 주만 ±1주(due_date 불변, 복제 없음) */
export function weeklyMoveTarget(weekStart: string, direction: -1 | 1): { target: string; label: string } {
  return { target: shiftWeekStart(weekStart, direction), label: direction < 0 ? '이전 주로' : '다음 주로' }
}
