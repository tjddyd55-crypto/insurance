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

export function weekRange(anchor: string): { start: string; end: string } {
  const [year, month, day] = anchor.split('-').map(Number)
  const sundayBased = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const mondayOffset = sundayBased === 0 ? -6 : 1 - sundayBased
  const start = addDaysYmd(anchor, mondayOffset)
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
