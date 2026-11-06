import { formatKstDate, formatKstTime } from '../../../utils/displayDateTime'
import type { ScheduleEvent } from '../api/scheduleApi'
import { addDaysYmd } from './scheduleRange'
import { WEEK_SLOT_MINUTES } from './scheduleWeekTimedLayout'

const MINUTES_PER_DAY = 24 * 60
export const DRAG_THRESHOLD_PX = 6
export const MIN_TIMED_MINUTES = WEEK_SLOT_MINUTES

export type TimedRange = {
  startDate: string
  startMinute: number
  endDate: string
  endMinute: number
}

export type TimedWriteFields = {
  date: string
  endDate: string
  allDay: false
  startTime: string
  endTime: string
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function clockToMinute(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

function toAbs(date: string, minute: number): number {
  const [year, month, day] = date.split('-').map(Number)
  return Math.round(Date.UTC(year, month - 1, day) / 86400000) * MINUTES_PER_DAY + minute
}

function fromAbs(abs: number): { date: string; minute: number } {
  const day = Math.floor(abs / MINUTES_PER_DAY)
  const minute = abs - day * MINUTES_PER_DAY
  return { date: new Date(day * 86400000).toISOString().slice(0, 10), minute }
}

export function formatMinute(minute: number): string {
  const safe = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return `${pad(Math.floor(safe / 60))}:${pad(safe % 60)}`
}

export function snapMinute(minute: number): number {
  return Math.round(minute / WEEK_SLOT_MINUTES) * WEEK_SLOT_MINUTES
}

export function pointerExceededThreshold(dx: number, dy: number): boolean {
  return dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX
}

export function readTimedRange(event: Pick<ScheduleEvent, 'allDay' | 'startAt' | 'endAt'>): TimedRange | null {
  if (event.allDay) return null
  const startDate = formatKstDate(event.startAt)
  const endDate = formatKstDate(event.endAt)
  const startMinute = clockToMinute(formatKstTime(event.startAt))
  const endMinute = clockToMinute(formatKstTime(event.endAt))
  if (!startDate || !endDate || startMinute == null || endMinute == null) return null
  return { startDate, startMinute, endDate, endMinute }
}

export function isCrossDayRange(range: TimedRange): boolean {
  return range.endDate !== range.startDate
}

export function canDragTimedEvent(event: ScheduleEvent): boolean {
  if (event.allDay || !readTimedRange(event)) return false
  if (event.origin === 'onefc') return true
  return event.source === 'google' && event.writable === true && Boolean(event.calendarId)
}

export function canResizeTimedEvent(event: ScheduleEvent): boolean {
  const range = readTimedRange(event)
  return canDragTimedEvent(event) && range != null && !isCrossDayRange(range)
}

export function rangeDuration(range: TimedRange): number {
  return toAbs(range.endDate, range.endMinute) - toAbs(range.startDate, range.startMinute)
}

function rangeFromAbs(startAbs: number, endAbs: number): TimedRange {
  const start = fromAbs(startAbs)
  const end = fromAbs(endAbs)
  return { startDate: start.date, startMinute: start.minute, endDate: end.date, endMinute: end.minute }
}

/** 시작을 30분 격자에 맞추고, 길이도 30분 배수(최소 30분)로 유지한다. */
export function moveTimedRange(range: TimedRange, deltaDays: number, deltaMinutes: number): TimedRange {
  const duration = Math.max(MIN_TIMED_MINUTES, snapMinute(rangeDuration(range)) || MIN_TIMED_MINUTES)
  const startAbs = snapMinute(toAbs(range.startDate, range.startMinute) + deltaDays * MINUTES_PER_DAY + deltaMinutes)
  return rangeFromAbs(startAbs, startAbs + duration)
}

/**
 * 같은 날 일정만 리사이즈한다. 자정을 넘는 일정은 null.
 * 끝은 최대 다음날 00:00(1440)까지.
 */
export function resizeTimedRange(range: TimedRange, edge: 'start' | 'end', pointerMinute: number): TimedRange | null {
  if (isCrossDayRange(range)) return null
  const snapped = snapMinute(pointerMinute)
  if (edge === 'start') {
    const startMinute = Math.min(snapped, range.endMinute - MIN_TIMED_MINUTES)
    return { ...range, startMinute: Math.max(0, startMinute) }
  }
  const endMinute = Math.max(snapped, range.startMinute + MIN_TIMED_MINUTES)
  if (endMinute >= MINUTES_PER_DAY) {
    return { ...range, endDate: addDaysYmd(range.startDate, 1), endMinute: 0 }
  }
  return { ...range, endMinute }
}

export function timedRangeWriteFields(range: TimedRange): TimedWriteFields {
  return {
    date: range.startDate,
    endDate: range.endDate,
    allDay: false,
    startTime: formatMinute(range.startMinute),
    endTime: formatMinute(range.endMinute),
  }
}

export function rangeToIso(date: string, minute: number): string {
  return `${date}T${formatMinute(minute)}:00+09:00`
}

export function eventWithTimedRange(event: ScheduleEvent, range: TimedRange): ScheduleEvent {
  return { ...event, allDay: false, startAt: rangeToIso(range.startDate, range.startMinute), endAt: rangeToIso(range.endDate, range.endMinute) }
}

export function dayIndexFromPointer(clientX: number, gridLeft: number, axisWidth: number, gridWidth: number): number {
  const dayWidth = (gridWidth - axisWidth) / 7
  if (dayWidth <= 0) return 0
  const index = Math.floor((clientX - gridLeft - axisWidth) / dayWidth)
  return Math.min(6, Math.max(0, index))
}

export function minuteFromPointer(clientY: number, gridTop: number, gridHeight: number): number {
  if (gridHeight <= 0) return 0
  const raw = ((clientY - gridTop) / gridHeight) * MINUTES_PER_DAY
  return Math.min(MINUTES_PER_DAY, Math.max(0, snapMinute(raw)))
}
