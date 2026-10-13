import assert from 'node:assert/strict'
import test from 'node:test'
import { mapBillingPromotionRedemptionRow } from './promotionAdminService.js'

test('coupon stats row exposes user name/login id and benefit period/status', () => {
  const now = Date.parse('2026-10-13T00:00:00Z')
  const row = mapBillingPromotionRedemptionRow({
    id: '7', user_id: 'u-1', username: 'tjddyd88', display_name: ' 홍길동 ',
    redeemed_at: '2026-10-01T00:00:00Z', free_starts_at: '2026-10-15T00:00:00Z', free_ends_at: '2026-11-15T00:00:00Z',
    subscription_status: 'trialing',
  }, now)
  assert.equal(row.displayName, '홍길동')
  assert.equal(row.username, 'tjddyd88')
  assert.equal(row.benefitStatus, 'scheduled')
  assert.equal(row.freeStartsAt, '2026-10-15T00:00:00Z')
  assert.equal(mapBillingPromotionRedemptionRow({ id: 1, user_id: 'x', free_ends_at: '2026-01-01T00:00:00Z' }, now).benefitStatus, 'ended')
  assert.equal(mapBillingPromotionRedemptionRow({ id: 2, user_id: 'x', free_starts_at: '2026-10-01T00:00:00Z', free_ends_at: '2026-12-01T00:00:00Z' }, now).benefitStatus, 'active')
})
