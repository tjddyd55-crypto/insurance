import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('card payment menu and routes wiring', () => {
  it('exposes global menu link as 카드 수납 and workspace tab slug', () => {
    const menu = readFileSync(join(root, 'src/features/dashboard/gaTenantMenu.ts'), 'utf8')
    const nav = readFileSync(
      join(root, 'src/features/customers/utils/customerWorkspaceNavigation.ts'),
      'utf8',
    )
    const router = readFileSync(join(root, 'src/appRouter.tsx'), 'utf8')
    assert.match(menu, /label:\s*'카드 수납'/)
    assert.match(menu, /path:\s*'\/premium-payments'/)
    assert.match(nav, /'premium-payments'/)
    assert.match(router, /path:\s*'premium-payments'/)
    assert.match(router, /:customerId\/premium-payments/)
  })

  it('registers separated card and contract APIs without reveal flow', () => {
    const api = readFileSync(join(root, 'server/registerCardPaymentApi.js'), 'utf8')
    assert.match(api, /payment-cards/)
    assert.match(api, /card-payment-contracts/)
    assert.doesNotMatch(api, /reveal-card-number|reauthenticate/)
  })
})
