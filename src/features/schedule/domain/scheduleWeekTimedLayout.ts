import { formatKstDate, formatKstTime } from '../../../utils/displayDateTime'
import type { ScheduleEvent } from '../api/scheduleApi'
import { addDaysYmd } from './scheduleRange'

/** 주간 시간 축 한 칸. 30분 단위로 시작·종료를 맞춘다. */
export const WEEK_SLOT_MINUTES = 30
export const WEEK_SLOTS_PER_DAY = (24 * 60) / WEEK_SLOT_MINUTES
const MINUTES_PER_DAY = 24 * 60
const DAY_WALK_LIMIT = 370

export type WeekTimedSegment = {
  event: ScheduleEvent
  date: string
  /** 그 날 0시부터의 시작 분. */
  startMinute: number
  /** 그 날 0시부터의 종료 분. 자정까지면 1440. 시작과 같으면 길이 0(1시간으로 늘리지 않음). */
  endMinute: number
  /** CSS grid line. 1 = 00:00. */
  rowStart: number
  /** CSS grid line. exclusive. */
  rowEnd: number
  lane: number
  laneCount: number
}

type ClockPoint = { date: string; minute: number }
type RawSegment = Omit<WeekTimedSegment, 'lane' | 'laneCount'>

function minutesOfClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

function kstPoint(iso: string): ClockPoint | null {
  const date = formatKstDate(iso)
  const minute = minutesOfClock(formatKstTime(iso))
  if (!date || minute == null) return null
  return { date, minute }
}

/** 화면 블록에 쓰는 'HH:MM - HH:MM'. 저장된 시작·종료 시각 그대로. */
export function timedEventRangeLabel(event: ScheduleEvent): string {
  const start = formatKstTime(event.startAt)
  const end = formatKstTime(event.endAt)
  if (!start) return ''
  if (!end || end === start) return start
  return `${start} - ${end}`
}

function rowsOf(startMinute: number, endMinute: number): { rowStart: number; rowEnd: number } {
  const rowStart = Math.floor(startMinute / WEEK_SLOT_MINUTES) + 1
  const exclusiveMinute = endMinute > startMinute ? endMinute : startMinute
  let rowEnd = Math.ceil(exclusiveMinute / WEEK_SLOT_MINUTES) + 1
  if (rowEnd <= rowStart) rowEnd = rowStart + 1
  const lastLine = WEEK_SLOTS_PER_DAY + 1
  return {
    rowStart: Math.min(rowStart, WEEK_SLOTS_PER_DAY),
    rowEnd: Math.min(rowEnd, lastLine),
  }
}

function pushDayPiece(pieces: Array<{ date: string; startMinute: number; endMinute: number }>, date: string, startMinute: number, endMinute: number) {
  if (endMinute <= startMinute) return
  pieces.push({ date, startMinute, endMinute })
}

/**
 * 시간 일정을 날짜별 구간으로 나눈다.
 * 23:30 → 다음날 00:30 은 첫날 1440(자정)까지 두고, 23:59 로 자르지 않는다.
 * 종료가 없거나 시작보다 이르면 1시간으로 만들지 않고 길이 0 으로 남긴다.
 */
function splitTimedRange(start: ClockPoint, end: ClockPoint | null): Array<{ date: string; startMinute: number; endMinute: number }> {
  if (!end || end.date < start.date || (end.date === start.date && end.minute <= start.minute)) {
    return [{ date: start.date, startMinute: start.minute, endMinute: start.minute }]
  }
  const pieces: Array<{ date: string; startMinute: number; endMinute: number }> = []
  let cursor = start.date
  for (let guard = 0; cursor <= end.date && guard < DAY_WALK_LIMIT; guard += 1) {
    const segStart = cursor === start.date ? start.minute : 0
    const segEnd = cursor === end.date ? end.minute : MINUTES_PER_DAY
    pushDayPiece(pieces, cursor, segStart, segEnd)
    if (cursor === end.date) break
    cursor = addDaysYmd(cursor, 1)
  }
  return pieces
}

function rawSegments(events: ScheduleEvent[], visible: Set<string>): RawSegment[] {
  const raw: RawSegment[] = []
  for (const event of events) {
    if (event.allDay) continue
    const start = kstPoint(event.startAt)
    if (!start) continue
    const pieces = splitTimedRange(start, kstPoint(event.endAt))
    for (const piece of pieces) {
      if (!visible.has(piece.date)) continue
      raw.push({ event, ...piece, ...rowsOf(piece.startMinute, piece.endMinute) })
    }
  }
  return raw
}

function stampLaneCount(items: WeekTimedSegment[], from: number, to: number) {
  let lanes = 1
  for (let index = from; index < to; index += 1) {
    lanes = Math.max(lanes, items[index].lane + 1)
  }
  for (let index = from; index < to; index += 1) {
    items[index].laneCount = lanes
  }
}

function layoutDay(group: RawSegment[]): WeekTimedSegment[] {
  const sorted = [...group].sort((left, right) => (
    left.startMinute - right.startMinute
    || left.endMinute - right.endMinute
    || left.event.title.localeCompare(right.event.title, 'ko')
  ))
  const laneEnds: number[] = []
  const placed: WeekTimedSegment[] = sorted.map((item) => {
    let lane = laneEnds.findIndex((end) => end <= item.startMinute)
    if (lane < 0) {
      lane = laneEnds.length
      laneEnds.push(item.endMinute)
    } else {
      laneEnds[lane] = item.endMinute
    }
    return { ...item, lane, laneCount: 1 }
  })
  let clusterStart = 0
  let clusterEnd = -1
  for (let index = 0; index < placed.length; index += 1) {
    const item = placed[index]
    if (index > clusterStart && item.startMinute >= clusterEnd) {
      stampLaneCount(placed, clusterStart, index)
      clusterStart = index
      clusterEnd = -1
    }
    clusterEnd = Math.max(clusterEnd, item.endMinute)
  }
  stampLaneCount(placed, clusterStart, placed.length)
  return placed
}

/** 보이는 주(YYYY-MM-DD) 안의 시간 일정만. 종일은 종일 행이 그린다. */
export function weekTimedSegments(events: ScheduleEvent[], dates: string[]): WeekTimedSegment[] {
  const visible = new Set(dates)
  const byDate = new Map<string, RawSegment[]>()
  for (const item of rawSegments(events, visible)) {
    const list = byDate.get(item.date) ?? []
    list.push(item)
    byDate.set(item.date, list)
  }
  const laid: WeekTimedSegment[] = []
  for (const group of byDate.values()) {
    laid.push(...layoutDay(group))
  }
  return laid
}
