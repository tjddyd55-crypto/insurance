import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const hookSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'useCustomerExpandedCardScroll.ts'),
  'utf8',
)

describe('useCustomerExpandedCardScroll', () => {
  it('does not attach ResizeObserver on pc accordion inner resizes', () => {
    expect(hookSource).not.toContain('ResizeObserver')
  })

  it('scrolls pc card only on initial expand settle', () => {
    expect(hookSource).toContain('scrollCustomerCardIntoListContainer')
    expect(hookSource).toMatch(/accordion open 등 내부 resize/)
  })
})
