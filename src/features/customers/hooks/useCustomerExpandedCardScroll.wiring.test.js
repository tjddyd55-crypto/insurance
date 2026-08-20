import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
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

    assert.match(hook, /resolveCustomerListScrollContainer/)
    assert.match(hook, /scrollCustomerCardIntoListContainer/)
    assert.match(hook, /pendingTargetIdRef/)
    assert.match(hook, /maxScrollPasses/)
    assert.doesNotMatch(hook, /scrollCountRef/)
    assert.match(fab, /resolveCustomerListScrollContainer/)
    assert.match(fab, /scrollCustomerListPanelToTop/)
    assert.match(fab, /computeCustomerListFabFixedPosition/)
    assert.doesNotMatch(fab, /translateX\(-50%\)/)
    assert.doesNotMatch(fab, /behavior:\s*['"]smooth['"]/)

    const scrollSsot = readFileSync(
      join(root, 'features/customers/utils/resolveCustomerListScrollContainer.ts'),
      'utf8',
    )
    assert.match(scrollSsot, /fastScrollCustomerListTo/)
    assert.match(scrollSsot, /customer-workspace-layout__left/)
    assert.match(scrollSsot, /hasScrollableOverflowY|left 지정|designated/)
    assert.doesNotMatch(
      scrollSsot,
      /scrollCustomerListPanelToTop[\s\S]*behavior:\s*['"]smooth['"]/,
    )

    const fabPos = readFileSync(
      join(root, 'features/customers/utils/resolveCustomerListFabPosition.ts'),
      'utf8',
    )
    assert.match(fabPos, /containerRect\.right/)
    assert.doesNotMatch(fabPos, /window\.innerWidth/)
    assert.doesNotMatch(fabPos, /innerHeight/)
    assert.match(nav, /resolveCustomerListScrollContainer/)
  })

  it('pc-root keeps left panel as scroll owner below 860px media', () => {
    const css = readFileSync(join(root, 'index.css'), 'utf8')
    assert.match(css, /\.pc-root \.customer-workspace-layout__left\s*\{[^}]*overflow:\s*auto/s)
    assert.match(
      css,
      /\.mobile-root \.customer-workspace-layout__left\s*\{[^}]*overflow:\s*visible/s,
    )
    const mqBlock = css.match(/@media \(max-width: 860px\) \{([\s\S]*?)\n\}/)
    assert.doesNotMatch(
      mqBlock?.[1] ?? '',
      /^\s*\.customer-workspace-layout__left\s*\{[^}]*overflow:\s*visible/m,
    )
  })
})
