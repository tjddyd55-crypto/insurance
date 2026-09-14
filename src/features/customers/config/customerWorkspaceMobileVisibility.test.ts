import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  CUSTOMER_WORKSPACE_ACTIONS_HIDDEN_ON_MOBILE,
  isCustomerWorkspaceActionVisible,
} from './customerWorkspaceMobileVisibility'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('customer workspace mobile action visibility', () => {
  it('hides map and premium payments on mobile only', () => {
    expect(CUSTOMER_WORKSPACE_ACTIONS_HIDDEN_ON_MOBILE).toEqual(['map', 'premiumPayments'])
    expect(isCustomerWorkspaceActionVisible('pc', 'map')).toBe(true)
    expect(isCustomerWorkspaceActionVisible('pc', 'premiumPayments')).toBe(true)
    expect(isCustomerWorkspaceActionVisible('mobile', 'map')).toBe(false)
    expect(isCustomerWorkspaceActionVisible('mobile', 'premiumPayments')).toBe(false)
  })

  it('mobile CustomerWorkspaceActions does not render hidden labels', () => {
    const actions = read('src/features/customers/components/CustomerWorkspaceActions.tsx')
    const mobileSlice = actions.slice(
      0,
      actions.indexOf('customer-detail-feature-actions customer-workspace-action-bar'),
    )
    expect(mobileSlice.includes('지도에서 보기')).toBe(false)
    expect(mobileSlice.includes('카드 수납')).toBe(false)
  })

  it('PC CustomerWorkspaceActions keeps map and card payment', () => {
    const actions = read('src/features/customers/components/CustomerWorkspaceActions.tsx')
    const pcSlice = actions.slice(
      actions.indexOf('customer-detail-feature-actions customer-workspace-action-bar'),
    )
    expect(pcSlice.includes('카드 수납')).toBe(true)
  })

  it('PC workspace tab bar keeps map and card payment', () => {
    const pc = read('src/features/customers/pages/workspace/CustomerWorkspaceLayoutPC.tsx')
    expect(pc.includes('지도에서 보기')).toBe(true)
    expect(pc.includes('카드 수납')).toBe(true)
  })

  it('mobile outlet modal header does not render map shortcut', () => {
    const mobile = read('src/features/customers/pages/workspace/CustomerWorkspaceLayoutMobile.tsx')
    expect(mobile.includes('지도에서 보기')).toBe(false)
  })
})
