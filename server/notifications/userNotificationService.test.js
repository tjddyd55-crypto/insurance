import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addMonthsToDateOnly,
  getKstEndOfDayDate,
  isCarExpiryDueForNotification,
  isDateWithinInclusiveRange,
  isInsuranceAgeDueForNotification,
  toDateOnlyString,
} from '../services/userNotificationService.js'
import { getKstDateString } from '../../shared/dateTimeKst.js'

const TODAY = '2026-06-26'

test('addMonthsToDateOnly advances calendar months on date-only strings', () => {
  assert.equal(addMonthsToDateOnly('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonthsToDateOnly('2026-04-25', 2), '2026-06-25')
  assert.equal(addMonthsToDateOnly(TODAY, 1), '2026-07-26')
  assert.equal(addMonthsToDateOnly(TODAY, 2), '2026-08-26')
})

test('getKstEndOfDayDate returns same KST calendar day', () => {
  const end = getKstEndOfDayDate(new Date('2026-06-25T03:00:00.000Z'))
  assert.match(end.toISOString(), /2026-06-25T14:59:59\.999Z/)
  assert.equal(getKstDateString(end), '2026-06-25')
})

test('toDateOnlyString normalizes YYYY-MM-DD and rejects locale strings', () => {
  assert.equal(toDateOnlyString('2026-08-26'), '2026-08-26')
  assert.equal(toDateOnlyString('2026-08-26T00:00:00.000Z'), '2026-08-26')
  assert.equal(toDateOnlyString('Wed Aug 26 2026'), '')
  assert.equal(toDateOnlyString(new Date('2026-08-25T15:00:00.000Z')), '2026-08-26')
})

test('isDateWithinInclusiveRange checks inclusive bounds', () => {
  assert.equal(isDateWithinInclusiveRange('2026-06-26', TODAY, '2026-07-26'), true)
  assert.equal(isDateWithinInclusiveRange('2026-07-26', TODAY, '2026-07-26'), true)
  assert.equal(isDateWithinInclusiveRange('2026-07-27', TODAY, '2026-07-26'), false)
  assert.equal(isDateWithinInclusiveRange('2026-06-25', TODAY, '2026-07-26'), false)
})

test('isCarExpiryDueForNotification uses today through today + 1 month window', () => {
  assert.equal(isCarExpiryDueForNotification('2026-06-26', TODAY), true)
  assert.equal(isCarExpiryDueForNotification('2026-07-06', TODAY), true)
  assert.equal(isCarExpiryDueForNotification('2026-07-26', TODAY), true)
  assert.equal(isCarExpiryDueForNotification('2026-07-27', TODAY), false)
  assert.equal(isCarExpiryDueForNotification('', TODAY), false)
})

test('isInsuranceAgeDueForNotification uses today through today + 2 months window', () => {
  assert.equal(isInsuranceAgeDueForNotification('2026-06-26', TODAY), true)
  assert.equal(isInsuranceAgeDueForNotification('2026-07-01', TODAY), true)
  assert.equal(isInsuranceAgeDueForNotification('2026-07-26', TODAY), true)
  assert.equal(isInsuranceAgeDueForNotification('2026-08-26', TODAY), true)
  assert.equal(isInsuranceAgeDueForNotification('2026-08-27', TODAY), false)
  assert.equal(isInsuranceAgeDueForNotification('', TODAY), false)
})
