import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('premium payments menu and routes wiring', () => {
  it('exposes global menu link and workspace tab slug', () => {
    const menu = readFileSync(join(root, 'src/features/dashboard/gaTenantMenu.ts'), 'utf8')
    const nav = readFileSync(
      join(root, 'src/features/customers/utils/customerWorkspaceNavigation.ts'),
      'utf8',
    )
    const router = readFileSync(join(root, 'src/appRouter.tsx'), 'utf8')
    assert.match(menu, /label:\s*'보험료 결제'/)
    assert.match(menu, /path:\s*'\/premium-payments'/)
    assert.match(nav, /'premium-payments'/)
    assert.match(router, /path:\s*'premium-payments'/)
    assert.match(router, /:customerId\/premium-payments/)
  })
})
