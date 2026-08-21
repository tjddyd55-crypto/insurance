import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '.')
const source = readFileSync(join(root, 'fastScrollCustomerList.ts'), 'utf8')

describe('fastScrollCustomerList', () => {
  it('uses a fixed short duration independent of distance', () => {
    assert.match(source, /CUSTOMER_LIST_FAST_SCROLL_DURATION_MS = 240/)
  })

  it('easeOutCubic clamps and eases out', () => {
    assert.match(source, /export function easeOutCubic/)
    assert.match(source, /1 - \(1 - t\) \*\* 3/)
  })

  it('animates only container.scrollTop', () => {
    assert.match(source, /container\.scrollTop/)
    assert.doesNotMatch(source, /window\.scrollTo/)
    assert.doesNotMatch(source, /document\.documentElement\.scroll/)
  })

  it('does not cancel animation on FAB pointerdown bubble', () => {
    assert.match(source, /customer-list-scroll-top-button/)
    assert.match(source, /event\.type === 'pointerdown'/)
  })
})
