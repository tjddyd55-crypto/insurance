import { describe, expect, it } from 'vitest'
import {
  SIGNATURE_WORKSPACE_NAV_FROM,
  parseSignatureWorkspaceExpandCustomerId,
} from './customerSignatureWorkspaceNavigation'
import { buildCustomerWorkspacePath } from './customerRoutePaths'

describe('customerSignatureWorkspaceNavigation', () => {
  it('reads expandCustomerId from signature-workspace navigation state', () => {
    expect(
      parseSignatureWorkspaceExpandCustomerId({
        from: SIGNATURE_WORKSPACE_NAV_FROM,
        expandCustomerId: 42,
      }),
    ).toBe(42)
  })

  it('ignores unrelated navigation state', () => {
    expect(parseSignatureWorkspaceExpandCustomerId({ from: 'claim-workspace', expandCustomerId: 1 })).toBeNull()
    expect(parseSignatureWorkspaceExpandCustomerId(null)).toBeNull()
  })

  it('builds customer-scoped signatures workspace path', () => {
    const qs = new URLSearchParams({ customerId: '42' })
    expect(buildCustomerWorkspacePath({ customerId: 42, tab: 'signatures', query: qs })).toBe(
      '/customers/42/signatures?customerId=42',
    )
  })
})
