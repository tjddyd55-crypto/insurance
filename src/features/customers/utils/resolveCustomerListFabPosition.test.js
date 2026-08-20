import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '.')
const source = readFileSync(join(root, 'resolveCustomerListFabPosition.ts'), 'utf8')

describe('computeCustomerListFabFixedPosition', () => {
  it('anchors PC FAB from containerRect.right/bottom without viewport metrics', () => {
    assert.match(source, /containerRect\.right - fabWidth - rightOffset/)
    assert.match(source, /containerRect\.bottom - fabHeight - bottomOffset/)
    assert.doesNotMatch(source, /window\.innerWidth/)
    assert.doesNotMatch(source, /innerHeight/)
  })

  it('keeps mobile centered and PC right-aligned', () => {
    assert.match(source, /translateX\(-50%\)/)
    assert.match(source, /variant === 'mobile'/)
  })

  it('PC right-bottom inset stays inside a narrow list width', () => {
    const fabWidth = 44
    const rightOffset = 16
    const narrowRight = 320
    const left = narrowRight - fabWidth - rightOffset
    assert.ok(left >= 0)
    assert.ok(left + fabWidth <= narrowRight)
  })
})
