import type { TodoDto } from './todoTypes'

/**
 * 주간 할 일 저장 키와 화면 주.
 *
 * 화면(일정 주간 · 주간 할 일 패널)은 일요일~토요일이다.
 * DB `weekly_focus_week_start` 와 API `weekStart` 는 그 일요일 주에 들어 있는 월요일이다.
 * 서버는 월요일만 받고, 운영 데이터도 그 월요일이라 마이그레이션하지 않는다.
 *
 * 예: 화면 2026-11-08(일)~11-14(토) ↔ 저장 키 2026-11-09(월).
 * 예전 화면 2026-11-02(월)~11-08(일)의 할 일은 키 2026-11-02 그대로이고,
 * 그 월요일을 포함하는 화면 주 2026-11-01~11-07 에 그대로 보인다.
 *
 * 읽기 비교는 월요일 키와 같은 주의 일요일 키를 둘 다 그 주로 본다.
 * 쓰기(추가·이동)는 항상 월요일 키만 보낸다.
 */

/** YYYY-MM-DD 달력일 + n일 (UTC 산술, 시간대 무관). */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function weekdayIndex(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** 그 날짜가 들어 있는 화면 주(일요일). */
export function uiWeekStartOfYmd(ymd: string): string {
  return addDaysYmd(ymd, -weekdayIndex(ymd))
}

/** 해당 날짜가 속한 달력 주의 월요일. 일요일은 그 전 주 월요일(저장 키로 쓰지 않는다). */
export function mondayOfYmd(ymd: string): string {
  return addDaysYmd(ymd, -((weekdayIndex(ymd) + 6) % 7))
}

/** API·DB에 넣는 월요일. 화면 주(일~토) 안의 월요일 = 일요일 + 1일. */
export function storedWeekKey(ymd: string): string {
  return addDaysYmd(uiWeekStartOfYmd(ymd), 1)
}

/** "11.01 ~ 11.07". 월요일 키를 넘겨도 그 키가 들어 있는 일~토로 보여 준다. */
export function formatWeekRangeLabel(weekStart: string): string {
  const start = uiWeekStartOfYmd(weekStart)
  const end = addDaysYmd(start, 6)
  const md = (v: string) => `${v.slice(5, 7)}.${v.slice(8, 10)}`
  return `${md(start)} ~ ${md(end)}`
}

/** 그 주 주간 할 일인지. 저장 월요일과, 같은 화면 주의 일요일 키를 둘 다 인정. 예정일 자동 포함 없음. */
export function belongsToWeek(todo: Pick<TodoDto, 'weeklyFocusWeekStart'>, weekStart: string): boolean {
  const stored = todo.weeklyFocusWeekStart
  if (!stored) return false
  return stored === storedWeekKey(weekStart) || stored === uiWeekStartOfYmd(weekStart)
}

/** 주간 패널 정렬: 미완료 먼저, 완료는 뒤(각각 서버 순서 유지) */
export function sortWeeklyTodos<T extends Pick<TodoDto, 'status'>>(rows: T[]): T[] {
  return [...rows.filter((r) => r.status !== 'completed'), ...rows.filter((r) => r.status === 'completed')]
}

/** 드래그 데이터 타입 */
export const WEEKLY_DRAG_MIME = 'application/x-onefc-todo-id'
/** 주간 패널 → 전체 목록으로 되돌리는 드래그 */
export const WEEKLY_BACK_DRAG_MIME = 'application/x-onefc-weekly-todo-id'

/** 화면 주(일요일) 기준 ±n주. 월요일 키를 넘겨도 그 키가 속한 일요일로 맞춘 뒤 이동한다. */
export function shiftWeekStart(weekStart: string, weeks: number): string {
  return addDaysYmd(uiWeekStartOfYmd(weekStart), weeks * 7)
}

/** 이전/다음 주로 이동. target 은 저장용 월요일(due_date 불변, 복제 없음). */
export function weeklyMoveTarget(weekStart: string, direction: -1 | 1): { target: string; label: string } {
  const uiWeek = shiftWeekStart(weekStart, direction)
  return { target: storedWeekKey(uiWeek), label: direction < 0 ? '이전 주로' : '다음 주로' }
}
