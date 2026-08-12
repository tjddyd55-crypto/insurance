import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('customer list scroll wiring', () => {
  it('expanded card scroll and scroll-top FAB share list scroll container SSOT', () => {
    const hook = readFileSync(
      join(root, 'features/customers/hooks/useCustomerExpandedCardScroll.ts'),
      'utf8',
    )
    const fab = readFileSync(
      join(root, 'features/customers/components/CustomerListScrollTopButton.tsx'),
      'utf8',
    )
    const nav = readFileSync(
      join(root, 'features/customers/utils/customerWorkspaceNavigation.ts'),
      'utf8',
    )

    expect(hook).toMatch(/resolveCustomerListScrollContainer/)
    expect(hook).toMatch(/scrollCustomerCardIntoListContainer/)
    expect(hook).toMatch(/pendingTargetIdRef/)
    expect(hook).toMatch(/maxScrollPasses/)
    expect(hook).not.toMatch(/scrollCountRef/)
    expect(fab).toMatch(/resolveCustomerListScrollContainer/)
    expect(fab).toMatch(/scrollCustomerListPanelToTop/)
    expect(nav).toMatch(/resolveCustomerListScrollContainer/)
  })

  it('pc-root keeps left panel as scroll owner below 860px media', () => {
    const css = readFileSync(join(root, 'index.css'), 'utf8')
    expect(css).toMatch(/\.pc-root \.customer-workspace-layout__left\s*\{[^}]*overflow:\s*auto/s)
    expect(css).toMatch(
      /\.mobile-root \.customer-workspace-layout__left\s*\{[^}]*overflow:\s*visible/s,
    )
    // width-only MQ must not strip PC left overflow
    const mqBlock = css.match(
      /@media \(max-width: 860px\) \{([\s\S]*?)\n\}/,
    )
    expect(mqBlock?.[1] ?? '').not.toMatch(
      /^\s*\.customer-workspace-layout__left\s*\{[^}]*overflow:\s*visible/m,
    )
  })
})
