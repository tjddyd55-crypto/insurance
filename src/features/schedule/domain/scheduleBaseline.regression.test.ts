import { describe, expect, it } from 'vitest'
import type { ScheduleEvent, ScheduleTask } from '../api/scheduleApi'
import { countScheduleItemsByDate } from './scheduleDayCount'
import { tasksOnDate } from './scheduleTasks'
import baseline from '../../../../server/schedule/__fixtures__/scheduleBaseline.json'

/** google-sync-v2 Phase 1 기준선: 서버 loadScheduleEvents 출력 → 배지 숫자·날짜별 노출. 표시 정책 변경 감지용. */
describe('일정 배지 회귀 기준선', () => {
  const events = baseline.events as unknown as ScheduleEvent[]
  const tasks = baseline.tasks as unknown as ScheduleTask[]
  it('날짜별 배지 = 일정(2+알림1+기한1) + 날짜 있는 미완료 할 일, 완료·날짜없음 제외', () => {
    expect(Object.fromEntries(countScheduleItemsByDate(events, tasks))).toEqual(baseline.expectedBadge)
  })
  it('10-22 할 일 칸에는 완료 포함 3건이 내려오고 배지에는 미완료 2건만 들어간다', () => {
    const day = tasksOnDate(tasks, '2026-10-22')
    expect(day.length).toBe(3)
    expect(day.filter((t) => t.status !== 'completed').length).toBe(2)
  })
})
