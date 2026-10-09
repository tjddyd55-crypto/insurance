import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'InsurerManagersPage.tsx'),
  'utf8',
)

describe('InsurerManagersPage company directory', () => {
  it('loads platform insurer catalog API, not GA company directory', () => {
    expect(source).toContain('hasInsurerManagersGaTenant')
    expect(source).toContain('listInsurerManagerCompanyChoicesApi')
    expect(source).toContain("queryKey: ['insurer-manager-company-choices'")
    expect(source).not.toContain('listCompanyDirectory')
  })
})
