import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildGaTenantDashboardMenu } from './gaTenantMenu'
import { isActivePcNavigationPath } from '../../components/layout/pcNavigationUtils'
import { SCHEDULE_LAST_VIEW_KEY } from '../schedule/domain/scheduleLastView'

describe('할일 및 알림 메뉴: 일정 관리', () => {
  it('할일 바로 다음에 일정 관리(/schedule) 링크', () => {
    const menu = buildGaTenantDashboardMenu(undefined, undefined) as Array<{ type: string; label: string; path?: string }>
    const todo = menu.findIndex((item) => item.type === 'link' && item.path === '/todos')
    expect(todo).toBeGreaterThanOrEqual(0)
    expect(menu[todo + 1]).toMatchObject({ type: 'link', label: '일정 관리', path: '/schedule' })
  })

  it('/schedule, /schedule/week 에서 활성, /todos 와 구분', () => {
    expect(isActivePcNavigationPath('/schedule', '/schedule')).toBe(true)
    expect(isActivePcNavigationPath('/schedule/week', '/schedule')).toBe(true)
    expect(isActivePcNavigationPath('/schedule/day', '/schedule/week')).toBe(true)
    expect(isActivePcNavigationPath('/schedule', '/todos')).toBe(false)
  })

  it('저장된 마지막 보기로 일정 관리 메뉴가 이동한다', () => {
    const saved = new Map<string, string>([[SCHEDULE_LAST_VIEW_KEY, 'week']])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
    })
    const menu = buildGaTenantDashboardMenu(undefined, undefined) as Array<{ type: string; label: string; path?: string }>
    const todo = menu.findIndex((item) => item.type === 'link' && item.path === '/todos')
    expect(menu[todo + 1]).toMatchObject({ type: 'link', label: '일정 관리', path: '/schedule/week' })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})
