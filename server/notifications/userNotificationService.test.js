import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addMonthsToDateOnly,
  getKstEndOfDayDate,
} from '../services/userNotificationService.js'
import { getKstDateString } from '../../shared/dateTimeKst.js'

test('addMonthsToDateOnly advances calendar months on date-only strings', () => {
  assert.equal(addMonthsToDateOnly('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonthsToDateOnly('2026-04-25', 2), '2026-06-25')
})

test('getKstEndOfDayDate returns same KST calendar day', () => {
  const end = getKstEndOfDayDate(new Date('2026-06-25T03:00:00.000Z'))
  assert.match(end.toISOString(), /2026-06-25T14:59:59\.999Z/)
  assert.equal(getKstDateString(end), '2026-06-25')
})
