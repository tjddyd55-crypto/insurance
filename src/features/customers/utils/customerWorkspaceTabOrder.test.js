import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('customer workspace tab order — premium-payments last', () => {
  it('puts premium-payments last in WORKSPACE_SIDE_DETAIL_TABS', () => {
    const src = read('src/features/customers/utils/customerWorkspaceNavigation.ts')
    const match = src.match(/WORKSPACE_SIDE_DETAIL_TABS = \[([\s\S]*?)\] as const/)
    assert.ok(match)
    const tabs = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    assert.equal(tabs[tabs.length - 1], 'premium-payments')
    assert.ok(tabs.indexOf('consultations') < tabs.indexOf('premium-payments'))
    assert.ok(tabs.indexOf('claim-requests') < tabs.indexOf('premium-payments'))
  })

  it('PC tab bar renders 카드 수납 after 청구관리', () => {
    const pc = read('src/features/customers/pages/workspace/CustomerWorkspaceLayoutPC.tsx')
    const claimsIdx = pc.lastIndexOf('청구관리')
    const paymentsIdx = pc.lastIndexOf('카드 수납')
    assert.ok(claimsIdx > 0)
    assert.ok(paymentsIdx > claimsIdx)
  })

  it('mobile actions render 카드 수납 after 복사', () => {
    const actions = read('src/features/customers/components/CustomerWorkspaceActions.tsx')
    const mobileSlice = actions.slice(
      0,
      actions.indexOf('customer-detail-feature-actions customer-workspace-action-bar'),
    )
    const copyIdx = mobileSlice.lastIndexOf('고객정보 복사')
    const paymentsIdx = mobileSlice.lastIndexOf('카드 수납')
    assert.ok(copyIdx > 0)
    assert.ok(paymentsIdx > copyIdx)
  })
})
