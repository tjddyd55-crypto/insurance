import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSignupWelcomeSmsPatchBody } from './registerSignupWelcomeSmsAdminApi.js'

test('parseSignupWelcomeSmsPatchBody: reset', () => {
  assert.deepEqual(parseSignupWelcomeSmsPatchBody({ resetToDefault: true }), { kind: 'reset' })
})

test('parseSignupWelcomeSmsPatchBody: save message', () => {
  assert.deepEqual(parseSignupWelcomeSmsPatchBody({ message: '안내' }), {
    kind: 'save',
    message: '안내',
  })
})

test('parseSignupWelcomeSmsPatchBody: invalid', () => {
  assert.deepEqual(parseSignupWelcomeSmsPatchBody({}), { kind: 'invalid' })
  assert.deepEqual(parseSignupWelcomeSmsPatchBody(null), { kind: 'invalid' })
})
