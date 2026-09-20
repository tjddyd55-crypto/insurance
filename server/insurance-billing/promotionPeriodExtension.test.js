import test from 'node:test'
import assert from 'node:assert/strict'
import { formatKstDate } from '../../shared/dateTimeKst.js'
import {
  computeFreeMonthsPromotionEndAt,
  resolvePromotionApplyTargetStatus,
  resolvePromotionExtensionBaseDate,
} from './promotionPeriodExtension.js'

test('FREE user — extension base is now', () => {
  const now = new Date('2026-09-21T00:00:00.000Z')
  const base = resolvePromotionExtensionBaseDate(null, now)
  assert.equal(formatKstDate(base), formatKstDate(now))
  const endAt = computeFreeMonthsPromotionEndAt(null, 3, now)
  assert.equal(formatKstDate(endAt), '2026-12-21')
})

test('trialing user — extends from future trial end', () => {
  const now = new Date('2026-09-21T00:00:00.000Z')
  const subscription = {
    status: 'trialing',
    trial_ends_at: '2026-12-20T00:00:00.000Z',
  }
  const base = resolvePromotionExtensionBaseDate(subscription, now)
  assert.equal(formatKstDate(base), '2026-12-20')
  const endAt = computeFreeMonthsPromotionEndAt(subscription, 3, now)
  assert.equal(formatKstDate(endAt), '2027-03-20')
})

test('active_paid user — extends from current period end', () => {
  const now = new Date('2026-09-21T00:00:00.000Z')
  const subscription = {
    status: 'active_paid',
    current_period_end: '2026-10-21T00:00:00.000Z',
  }
  const endAt = computeFreeMonthsPromotionEndAt(subscription, 3, now)
  assert.equal(formatKstDate(endAt), '2027-01-21')
  assert.equal(resolvePromotionApplyTargetStatus('active_paid'), 'active_paid')
})
