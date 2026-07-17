import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addMonthsToDateOnly,
  getKstEndOfDayDate,
  isCarExpiryDueForNotification,
  isDateWithinInclusiveRange,
  isInsuranceAgeDueForNotification,
  isSpecialDateDueForNotification,
  toDateOnlyString,
} from '../services/userNotificationService.js'
import { addDaysToDateOnly, getKstDateString } from '../../shared/dateTimeKst.js'
import { computeNextAnnualOccurrence } from '../../shared/annualOccurrenceDate.js'
import {
  getDefaultUserNotificationSettings,
  normalizeDaysBefore,
  normalizeUserNotificationSettingsPatch,
} from '../services/userNotificationSettingsService.js'

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

test('isCarExpiryDueForNotification uses configurable days window (default 30)', () => {
  assert.equal(isCarExpiryDueForNotification('2026-06-26', TODAY), true)
  assert.equal(isCarExpiryDueForNotification('2026-07-06', TODAY), true)
  assert.equal(isCarExpiryDueForNotification('2026-07-26', TODAY), true)
  assert.equal(isCarExpiryDueForNotification('2026-07-27', TODAY), false)
  assert.equal(isCarExpiryDueForNotification('2026-07-16', TODAY, 20), true)
  assert.equal(isCarExpiryDueForNotification('2026-07-17', TODAY, 20), false)
  assert.equal(isCarExpiryDueForNotification('2026-06-25', TODAY, 20), false)
  assert.equal(isCarExpiryDueForNotification('', TODAY), false)
})

test('addDaysToDateOnly adds calendar days on date-only strings', () => {
  assert.equal(addDaysToDateOnly(TODAY, 30), '2026-07-26')
  assert.equal(addDaysToDateOnly(TODAY, 31), '2026-07-27')
  assert.equal(addDaysToDateOnly('2026-01-31', 1), '2026-02-01')
})

test('isInsuranceAgeDueForNotification uses configurable days window', () => {
  assert.equal(isInsuranceAgeDueForNotification('2026-06-26', TODAY), true)
  assert.equal(isInsuranceAgeDueForNotification('2026-07-01', TODAY), true)
  assert.equal(isInsuranceAgeDueForNotification('2026-07-26', TODAY), true)
  assert.equal(isInsuranceAgeDueForNotification('2026-06-25', TODAY), false)
  assert.equal(isInsuranceAgeDueForNotification('2026-07-27', TODAY), false)
  assert.equal(isInsuranceAgeDueForNotification('2026-07-06', TODAY, 10), true)
  assert.equal(isInsuranceAgeDueForNotification('2026-07-07', TODAY, 10), false)
  assert.equal(isInsuranceAgeDueForNotification('', TODAY), false)
})

test('isSpecialDateDueForNotification matches days window', () => {
  assert.equal(isSpecialDateDueForNotification('2026-06-26', TODAY, 14), true)
  assert.equal(isSpecialDateDueForNotification('2026-07-10', TODAY, 14), true)
  assert.equal(isSpecialDateDueForNotification('2026-07-11', TODAY, 14), false)
  assert.equal(isSpecialDateDueForNotification('2026-06-25', TODAY, 14), false)
})

test('computeNextAnnualOccurrence keeps today and rolls past dates to next year', () => {
  assert.equal(computeNextAnnualOccurrence('2020-06-26', TODAY), '2026-06-26')
  assert.equal(computeNextAnnualOccurrence('2020-07-10', TODAY), '2026-07-10')
  assert.equal(computeNextAnnualOccurrence('2020-06-25', TODAY), '2027-06-25')
  assert.equal(computeNextAnnualOccurrence('2024-02-29', '2026-03-01'), '2027-02-28')
})

test('getDefaultUserNotificationSettings returns ON + 30 days defaults', () => {
  assert.deepEqual(getDefaultUserNotificationSettings(), {
    insuranceAge: { enabled: true, daysBefore: 30 },
    carExpiry: { enabled: true, daysBefore: 30 },
    specialDate: { enabled: true, daysBefore: 30 },
    claimRequest: { enabled: true },
  })
})

test('normalizeDaysBefore rejects invalid values', () => {
  assert.equal(normalizeDaysBefore(0), 0)
  assert.equal(normalizeDaysBefore(30), 30)
  assert.equal(normalizeDaysBefore(365), 365)
  assert.equal(normalizeDaysBefore(-1), null)
  assert.equal(normalizeDaysBefore(366), null)
  assert.equal(normalizeDaysBefore(''), null)
  assert.equal(normalizeDaysBefore('abc'), null)
  assert.equal(normalizeDaysBefore(1.5), null)
})

test('normalizeUserNotificationSettingsPatch merges and validates', () => {
  const base = getDefaultUserNotificationSettings()
  const ok = normalizeUserNotificationSettingsPatch(
    {
      insuranceAge: { enabled: true, daysBefore: 10 },
      claimRequest: { enabled: false },
    },
    base,
  )
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.data.insuranceAge.daysBefore, 10)
    assert.equal(ok.data.claimRequest.enabled, false)
    assert.equal(ok.data.carExpiry.enabled, true)
    assert.equal(ok.data.carExpiry.daysBefore, 30)
  }

  const bad = normalizeUserNotificationSettingsPatch(
    { insuranceAge: { daysBefore: -5 } },
    base,
  )
  assert.equal(bad.ok, false)

  const over = normalizeUserNotificationSettingsPatch(
    { carExpiry: { daysBefore: 400 } },
    base,
  )
  assert.equal(over.ok, false)
})
