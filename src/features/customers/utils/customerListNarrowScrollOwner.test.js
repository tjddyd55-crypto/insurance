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
const fastScroll = readFileSync(
  join(root, 'features/customers/utils/fastScrollCustomerList.ts'),
  'utf8',
)
const fab = readFileSync(
  join(root, 'features/customers/components/CustomerListScrollTopButton.tsx'),
  'utf8',
)

describe('PC narrow customer list scroll owner', () => {
  it('C. PC left keeps overflow-y auto and height chain under pc-root', () => {
    assert.match(
      css,
      /\.pc-root \.customer-workspace-layout__left\s*\{[^}]*overflow-y:\s*auto/s,
    )
    assert.match(
      css,
      /\.pc-root \.customer-workspace-layout\s*\{[^}]*min-height:\s*0/s,
    )
    assert.match(
      css,
      /app-main-content[^{]*:has\(\.customer-workspace-layout\)[^{]*\{[^}]*overflow:\s*hidden/s,
    )
  })

  it('E. left present blocks app-main promotion in resolver', () => {
    assert.match(scrollSsot, /left 지정 port 가 있으면 app-main/)
    assert.match(scrollSsot, /left 가 있으면 ancestor walk/)
    assert.doesNotMatch(
      scrollSsot,
      /if\s*\(\s*viewportWidth|innerWidth\s*<|max-width/,
    )
  })

  it('I. FAB and auto-scroll share resolveCustomerListScrollContainer', () => {
    assert.match(fab, /resolveCustomerListScrollContainer/)
    assert.match(fab, /scrollCustomerListPanelToTop/)
    assert.match(scrollSsot, /scrollCustomerCardIntoListContainer/)
  })

  it('scrollCustomerListPanelToTop always targets scrollTop 0', () => {
    assert.match(scrollSsot, /fastScrollCustomerListTo\(container,\s*0\)/)
    assert.doesNotMatch(scrollSsot, /pageTop - containerTop/)
  })

  it('G. programmatic FAB pointerdown does not cancel fast scroll', () => {
    assert.match(fastScroll, /customer-list-scroll-top-button/)
    assert.match(fastScroll, /event\.type === 'pointerdown'/)
  })

  it('D. mobile-root still releases left overflow only under mobile', () => {
    assert.match(
      css,
      /\.mobile-root \.customer-workspace-layout__left\s*\{[^}]*overflow:\s*visible/s,
    )
  })
})
