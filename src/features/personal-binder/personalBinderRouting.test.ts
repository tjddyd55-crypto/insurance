import { describe, expect, it } from 'vitest'

import { buildGaTenantDashboardMenu } from '../dashboard/gaTenantMenu'

describe('personal binder menu and routing', () => {
  it('exposes 내 바인더 in the shared app menu SSOT', () => {
    const menu = buildGaTenantDashboardMenu(undefined, undefined)
    expect(menu).toContainEqual({
      type: 'link',
      label: '내 바인더',
      path: '/personal-binders',
    })
  })
})
