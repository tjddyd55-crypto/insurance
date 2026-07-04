import assert from 'node:assert/strict'
import test from 'node:test'

import {
  parseShareVisibilityEnabledFromBody,
  shareVisibilitySuccessPayload,
} from './userInsurerAccountShareVisibilityApi.js'

test('parseShareVisibilityEnabledFromBody — enabled true/false 허용', () => {
  assert.equal(parseShareVisibilityEnabledFromBody({ enabled: true }), true)
  assert.equal(parseShareVisibilityEnabledFromBody({ enabled: false }), false)
})

test('parseShareVisibilityEnabledFromBody — isEnabled 임시 호환', () => {
  assert.equal(parseShareVisibilityEnabledFromBody({ isEnabled: true }), true)
  assert.equal(parseShareVisibilityEnabledFromBody({ isEnabled: false }), false)
})

test('parseShareVisibilityEnabledFromBody — enabled 우선', () => {
  assert.equal(parseShareVisibilityEnabledFromBody({ enabled: false, isEnabled: true }), false)
})

test('parseShareVisibilityEnabledFromBody — 빈 body / 잘못된 타입은 null', () => {
  assert.equal(parseShareVisibilityEnabledFromBody({}), null)
  assert.equal(parseShareVisibilityEnabledFromBody({ enabled: 'true' }), null)
  assert.equal(parseShareVisibilityEnabledFromBody({ enabled: 1 }), null)
  assert.equal(parseShareVisibilityEnabledFromBody(null), null)
  assert.equal(parseShareVisibilityEnabledFromBody(undefined), null)
})

test('shareVisibilitySuccessPayload — success/data/enabled envelope', () => {
  assert.deepEqual(shareVisibilitySuccessPayload(true), {
    success: true,
    data: { enabled: true },
  })
  assert.deepEqual(shareVisibilitySuccessPayload(false), {
    success: true,
    data: { enabled: false },
  })
})
