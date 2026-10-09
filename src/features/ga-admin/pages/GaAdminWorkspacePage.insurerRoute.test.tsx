import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'GaAdminWorkspacePage.tsx'),
  'utf8',
)

describe('GaAdminWorkspacePage insurer account route', () => {
  it('uses insurer_managers page instead of user vault', () => {
    expect(pageSource).toContain('InsurerManagersPage')
    expect(pageSource).toContain('embedded')
    expect(pageSource).not.toContain('UserInsurerAccountsPage')
  })
})
