import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveSignupDisplayName } from './signupDisplayName.js'

test('resolveSignupDisplayName prefers name over display_name', () => {
  assert.equal(
    resolveSignupDisplayName({ name: '김현민', display_name: '박성용' }),
    '김현민',
  )
})

test('resolveSignupDisplayName accepts display_name only', () => {
  assert.equal(resolveSignupDisplayName({ display_name: '김현민' }), '김현민')
})

test('resolveSignupDisplayName trims whitespace', () => {
  assert.equal(resolveSignupDisplayName({ name: '  김현민  ' }), '김현민')
})
