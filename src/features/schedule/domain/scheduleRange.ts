export type ScheduleView = 'month' | 'week' | 'day' | 'list'

const VIEWS: ScheduleView[] = ['month', 'week', 'day', 'list']

export function scheduleViewFromParam(value: string | undefined): ScheduleView {
  return VIEWS.includes(value as ScheduleView) ? (value as ScheduleView) : 'month'
}

export function seoulToday(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  utc.setUTCDate(utc.getUTCDate() + days)
  const y = utc.getUTCFullYear()
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const d = String(utc.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function monthGridRange(anchor: string): {
  start: string
  end: string
  monthStart: string
  monthEnd: string
  month: string
} {
  const month = anchor.slice(0, 7)
  const [year, monthNumber] = month.split('-').map(Number)
  const monthStart = `${month}-01`
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1
  const nextYear = monthNumber === 12 ? year + 1 : year
  const monthEnd = addDaysYmd(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01`, -1)
  const lead = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay()
  const start = addDaysYmd(monthStart, -lead)
  return { start, end: addDaysYmd(start, 41), monthStart, monthEnd, month }
}

/** 주간은 월간 그리드와 같이 일요일 시작(일~토). */
export function weekRange(anchor: string): { start: string; end: string } {
  const [year, month, day] = anchor.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const start = addDaysYmd(anchor, -weekday)
  return { start, end: addDaysYmd(start, 6) }
}

export function viewQueryRange(view: ScheduleView, anchor: string): { start: string; end: string } {
  if (view === 'week') {
    return weekRange(anchor)
  }
  if (view === 'day') {
    return { start: anchor, end: anchor }
  }
  const grid = monthGridRange(anchor)
  if (view === 'list') {
    return { start: grid.monthStart, end: grid.monthEnd }
  }
  return { start: grid.start, end: grid.end }
}

export function monthCells(anchor: string): Array<{ date: string; inMonth: boolean }> {
  const grid = monthGridRange(anchor)
  const cells: Array<{ date: string; inMonth: boolean }> = []
  let cursor = grid.start
  for (let index = 0; index < 42; index += 1) {
    cells.push({ date: cursor, inMonth: cursor.slice(0, 7) === grid.month })
    cursor = addDaysYmd(cursor, 1)
  }
  return cells
}

export function weekDays(anchor: string): string[] {
  const { start } = weekRange(anchor)
  return Array.from({ length: 7 }, (_, index) => addDaysYmd(start, index))
}

export function shiftAnchor(view: ScheduleView, anchor: string, delta: number): string {
  if (view === 'week') {
    return addDaysYmd(anchor, delta * 7)
  }
  if (view === 'day') {
    return addDaysYmd(anchor, delta)
  }
  const [year, month] = anchor.slice(0, 7).split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-01`
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

function weekdayOf(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number)
  return WEEKDAY_KO[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? ''
}

/** 상단 기간 제목. 월간 `2026년 10월`, 주간 `2026.10.11 – 10.17`, 일간 `2026년 10월 2일 (금)` */
export function periodTitle(view: ScheduleView, anchor: string): string {
  const [year, month, day] = anchor.split('-').map(Number)
  if (view === 'week') {
    const { start, end } = weekRange(anchor)
    const sameYear = start.slice(0, 4) === end.slice(0, 4)
    const endLabel = sameYear ? end.slice(5).replace('-', '.') : end.replace(/-/g, '.')
    return `${start.replace(/-/g, '.')} – ${endLabel}`
  }
  if (view === 'day') {
    return `${year}년 ${month}월 ${day}일 (${weekdayOf(anchor)})`
  }
  return `${year}년 ${month}월`
}
