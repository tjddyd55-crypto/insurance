import type { ScheduleEvent, ScheduleTask } from '../api/scheduleApi'
import { eventEndDay, eventStartDay } from './scheduleEventTime'
import { addDaysYmd } from './scheduleRange'

/**
 * 달력 날짜 숫자 배지 — 웹(PC·모바일)·앱·위젯 공통 규칙(SSOT: GET /api/schedule/events 응답).
 * - 일정(Google 일정·알림일·자동차 만기·상령일): 걸친 모든 날(KST)에 1씩. 종일 endAt 은 exclusive, 시간 일정이 자정에 끝나면 그 날 제외.
 * - 할 일(ONE FC 할 일·Google Tasks): 예정일(dueDate) 하루에 1. 예정일 없음은 세지 않는다. 완료도 센다.
 * - 취소·삭제 항목 제외, Google 일정 id 중복 제거는 서버가 한다. 화면 필터(출처·완료 보기)와 무관하다.
 * 원본 데이터는 바꾸지 않는다.
 */
export function countScheduleItemsByDate(events: readonly ScheduleEvent[], tasks: readonly ScheduleTask[]): Map<string, number> {
  const counts = new Map<string, number>()
  const bump = (day: string) => counts.set(day, (counts.get(day) ?? 0) + 1)
  for (const event of events) {
    const last = eventEndDay(event)
    for (let day = eventStartDay(event), guard = 0; day <= last && guard < 400; day = addDaysYmd(day, 1), guard += 1) bump(day)
  }
  for (const task of tasks) if (task.dueDate) bump(task.dueDate)
  return counts
}

/** 배지 문구: 0 이면 빈 문자열(표시 안 함), 10 이상은 "9+". */
export function dayCountLabel(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return ''
  return count > 9 ? '9+' : String(Math.floor(count))
}
