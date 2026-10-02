import { formatKstDate, formatKstTime } from '../../../utils/displayDateTime'
import type { ScheduleEvent } from '../api/scheduleApi'
import { addDaysYmd } from './scheduleRange'

/** 시작 달력일(서울). 종일은 저장된 달력일 그대로. */
export function eventStartDay(event: ScheduleEvent): string {
  return event.allDay ? event.startAt.slice(0, 10) : formatKstDate(event.startAt) || event.startAt.slice(0, 10)
}

/** 마지막 달력일(서울, 포함). 종일 endAt 은 exclusive, 시간 일정은 자정 끝이면 그 날 제외. */
export function eventEndDay(event: ScheduleEvent): string {
  const start = eventStartDay(event)
  if (event.allDay) {
    const end = event.endAt.slice(0, 10)
    return !end || end <= start ? start : addDaysYmd(end, -1)
  }
  const endMs = new Date(event.endAt).getTime()
  const startMs = new Date(event.startAt).getTime()
  if (Number.isNaN(endMs) || endMs <= startMs) {
    return start
  }
  return formatKstDate(new Date(endMs - 1)) || start
}

export function eventCoversDate(event: ScheduleEvent, date: string): boolean {
  return eventStartDay(event) <= date && date <= eventEndDay(event)
}

export function eventClock(event: ScheduleEvent): string {
  if (event.allDay) {
    return '종일'
  }
  const start = formatKstTime(event.startAt)
  const end = formatKstTime(event.endAt)
  return end && end !== start ? `${start}–${end}` : start
}

export function eventHour(event: ScheduleEvent): number | null {
  if (event.allDay) {
    return null
  }
  const time = formatKstTime(event.startAt)
  return time ? Number(time.slice(0, 2)) : null
}

export function sortScheduleEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  return [...events].sort((left, right) => {
    const day = eventStartDay(left).localeCompare(eventStartDay(right))
    if (day) return day
    if (left.allDay !== right.allDay) return left.allDay ? -1 : 1
    const time = (left.allDay ? '' : formatKstTime(left.startAt)).localeCompare(right.allDay ? '' : formatKstTime(right.startAt))
    return time || left.title.localeCompare(right.title, 'ko')
  })
}
