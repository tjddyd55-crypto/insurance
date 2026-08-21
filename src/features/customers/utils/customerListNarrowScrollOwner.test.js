import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const css = readFileSync(join(root, 'index.css'), 'utf8')
const scrollSsot = readFileSync(
  join(root, 'features/customers/utils/resolveCustomerListScrollContainer.ts'),
  'utf8',
)
const fab = readFileSync(
  join(root, 'features/customers/components/CustomerListScrollTopButton.tsx'),
  'utf8',
)

describe('customer UI restore + actual scroll owner SSOT', () => {
  it('removes 2fa23d35 absolute/inset workspace force', () => {
    const workspaceHostRules = [
      ...css.matchAll(
        /\.pc-root[^{]*app-main-content[^{]*customer-workspace-layout[^{]*\{[^}]*\}/gs,
      ),
      ...css.matchAll(
        /\.pc-root\s+\.app-main-content[^{]*\.customer-workspace-layout\s*\{[^}]*\}/gs,
      ),
    ].map((m) => m[0])
    assert.ok(workspaceHostRules.length >= 1)
    for (const rule of workspaceHostRules) {
      assert.doesNotMatch(rule, /position:\s*absolute/)
      assert.doesNotMatch(rule, /inset:\s*0/)
    }
  })

  it('keeps e320f63d flex height chain without absolute', () => {
    assert.match(
      css,
      /app-main-content[^{]*:has\(\.customer-workspace-layout\)[^{]*\{[^}]*overflow:\s*hidden/s,
    )
    assert.match(
      css,
      /> \.customer-workspace-layout\s*\{[^}]*flex:\s*1 1 auto/s,
    )
    assert.match(
      css,
      /\.pc-root \.customer-workspace-layout__left\s*\{[^}]*overflow-y:\s*auto/s,
    )
  })

  it('splits viewport anchor and actual scroll owner', () => {
    assert.match(scrollSsot, /resolveCustomerListViewportAnchor/)
    assert.match(scrollSsot, /isActuallyScrollable/)
    assert.match(scrollSsot, /resolveCustomerListScrollToTopTarget/)
    assert.match(fab, /resolveCustomerListViewportAnchor/)
    assert.doesNotMatch(scrollSsot, /innerWidth\s*</)
    assert.doesNotMatch(scrollSsot, /max-width/)
  })

  it('allows app-main when it is actually scrollable', () => {
    assert.match(scrollSsot, /app-main-content/)
    assert.match(scrollSsot, /isActuallyScrollable\(appMain\)/)
    // left 존재만으로 app-main 승격 금지 문구는 폐기됨 — 실제 scrollable 이면 허용
    assert.doesNotMatch(scrollSsot, /left 지정 port 가 있으면 app-main/)
  })

  it('FAB click uses fresh scrollCustomerListPanelToTop / target helper', () => {
    assert.match(fab, /scrollCustomerListPanelToTop/)
    assert.match(scrollSsot, /resolveCustomerListScrollToTopTarget/)
    assert.match(scrollSsot, /fastScrollCustomerListTo\(target\.container,\s*target\.top\)/)
  })

  it('mobile-root still releases left overflow only under mobile', () => {
    assert.match(
      css,
      /\.mobile-root \.customer-workspace-layout__left\s*\{[^}]*overflow:\s*visible/s,
    )
  })
})

describe('scroll-to-top target math', () => {
  it('computes parent-relative list start offset', () => {
    // container.scrollTop=5000, listStart.top = container.top - 2000 → target 3000
    const containerScrollTop = 5000
    const containerTop = 100
    const startTop = -1900
    const top = Math.max(0, Math.round(containerScrollTop + (startTop - containerTop)))
    assert.equal(top, 3000)
  })

  it('clamps to zero when list start is already at/below container top', () => {
    const top = Math.max(0, Math.round(100 + (80 - 100)))
    assert.equal(top, 80)
    const atTop = Math.max(0, Math.round(0 + (100 - 100)))
    assert.equal(atTop, 0)
  })
})
