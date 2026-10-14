import { describe, expect, it } from 'vitest'
import { buildGaTenantDashboardMenu } from './gaTenantMenu'
import { isActivePcNavigationPath } from '../../components/layout/pcNavigationUtils'

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
    expect(isActivePcNavigationPath('/schedule', '/todos')).toBe(false)
  })
})
