import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'InsurerManagersPage.tsx'),
  'utf8',
)

describe('InsurerManagersPage company directory', () => {
  it('loads directory by gaId tenant SSOT, not gaCode-only gate', () => {
    expect(source).toContain('hasInsurerManagersGaTenant')
    expect(source).toContain("enabled: Boolean(token && hasGaTenant && !isLossAdjusterMode)")
    expect(source).not.toMatch(/enabled:\s*Boolean\(token\s*&&\s*gaCode/)
  })
})
