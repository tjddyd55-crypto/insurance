import test from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateAutomationTargetScope,
  mapAutomationTargetFiltersFromInput,
  mapAutomationTargetFiltersFromRuleRow,
  SMS_AUTOMATION_AGE_UNKNOWN_NOTE,
  SMS_AUTOMATION_MINOR_EXCLUDE_REASON,
} from './smsAutomationTargetFilter.js'

test('mapAutomationTargetFiltersFromInput defaults excludeMinors to false', () => {
  assert.deepEqual(mapAutomationTargetFiltersFromInput({}), { excludeMinors: false })
  assert.deepEqual(mapAutomationTargetFiltersFromInput({ exclude_minors: false }), {
    excludeMinors: false,
  })
  assert.deepEqual(mapAutomationTargetFiltersFromInput({ excludeMinors: true }), {
    excludeMinors: true,
  })
})

test('mapAutomationTargetFiltersFromRuleRow reads persisted column', () => {
  assert.deepEqual(mapAutomationTargetFiltersFromRuleRow({ exclude_minors: true }), {
    excludeMinors: true,
  })
  assert.deepEqual(mapAutomationTargetFiltersFromRuleRow({ exclude_minors: false }), {
    excludeMinors: false,
  })
})

test('evaluateAutomationTargetScope skips filter when excludeMinors is false', () => {
  const result = evaluateAutomationTargetScope(
    { birth_date: '2015-01-01' },
    '2026-07-09',
    { excludeMinors: false },
  )
  assert.equal(result.excluded, false)
  assert.equal(result.scopeNote, null)
})

test('evaluateAutomationTargetScope excludes minors when enabled', () => {
  const result = evaluateAutomationTargetScope(
    { birth_date: '2010-01-01' },
    '2026-07-09',
    { excludeMinors: true },
  )
  assert.equal(result.excluded, true)
  assert.equal(result.excludedReason, SMS_AUTOMATION_MINOR_EXCLUDE_REASON)
})

test('evaluateAutomationTargetScope keeps unknown age with note', () => {
  const result = evaluateAutomationTargetScope({ name: '테스트' }, '2026-07-09', {
    excludeMinors: true,
  })
  assert.equal(result.excluded, false)
  assert.equal(result.scopeNote, SMS_AUTOMATION_AGE_UNKNOWN_NOTE)
})

test('evaluateAutomationTargetScope allows adult from RRN', () => {
  const result = evaluateAutomationTargetScope({ ssn: '9001021' }, '2026-07-09', {
    excludeMinors: true,
  })
  assert.equal(result.excluded, false)
  assert.equal(result.scopeNote, null)
})
