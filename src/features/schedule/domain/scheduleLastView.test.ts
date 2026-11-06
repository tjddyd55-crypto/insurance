import { describe, expect, it } from 'vitest'
import {
  SCHEDULE_LAST_VIEW_KEY,
  readScheduleLastView,
  resolveScheduleView,
  scheduleViewPath,
  writeScheduleLastView,
} from './scheduleLastView'

function memoryStorage() {
  const saved = new Map<string, string>()
  return {
    saved,
    storage: {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
    },
  }
}

describe('일정 마지막 보기', () => {
  it('명시된 route, 저장된 보기, 월간 순으로 고른다', () => {
    expect(resolveScheduleView('week', 'month')).toBe('week')
    expect(resolveScheduleView('day', null)).toBe('day')
    expect(resolveScheduleView('list', 'week')).toBe('list')
    expect(resolveScheduleView('month', 'week')).toBe('month')
    expect(resolveScheduleView(undefined, 'week')).toBe('week')
    expect(resolveScheduleView(undefined, 'day')).toBe('day')
    expect(resolveScheduleView('nope', 'list')).toBe('list')
    expect(resolveScheduleView(undefined, null)).toBe('month')
    expect(resolveScheduleView('nope', null)).toBe('month')
  })

  it('onefc.schedule.lastView 에만 저장하고 잘못된 값은 버린다', () => {
    const { saved, storage } = memoryStorage()
    expect(readScheduleLastView(storage)).toBeNull()
    writeScheduleLastView('week', storage)
    expect(saved.get(SCHEDULE_LAST_VIEW_KEY)).toBe('week')
    expect(readScheduleLastView(storage)).toBe('week')
    saved.set(SCHEDULE_LAST_VIEW_KEY, 'agenda')
    expect(readScheduleLastView(storage)).toBeNull()
  })

  it('메뉴 경로는 저장된 보기다', () => {
    expect(scheduleViewPath('month')).toBe('/schedule')
    expect(scheduleViewPath('week')).toBe('/schedule/week')
    expect(scheduleViewPath('day')).toBe('/schedule/day')
    expect(scheduleViewPath('list')).toBe('/schedule/list')
  })
})
