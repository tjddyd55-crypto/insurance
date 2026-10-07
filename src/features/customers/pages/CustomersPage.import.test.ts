import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const customersPageSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'CustomersPage.tsx'),
  'utf8',
)

describe('CustomersPage merge helper wiring', () => {
  it('imports mergeCustomerInList from customerListOpenState', () => {
    expect(customersPageSource).toMatch(/import\s*\{[^}]*mergeCustomerInList[^}]*\}\s*from\s*['"]\.\.\/utils\/customerListOpenState['"]/)
  })

  it('defines mergeCustomerInListState callback for post-update cache merge', () => {
    expect(customersPageSource).toContain('const mergeCustomerInListState = useCallback')
    expect(customersPageSource).toContain('mergeCustomerInList(prev, updated)')
  })
})
