import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canAccessSharedAccountManagement,
  canAccessSharedAccountUserList,
} from './sharedAccountAccess.js'

test('shared account list — GA_STAFF + gaId 이면 허용', () => {
  assert.equal(
    canAccessSharedAccountUserList({
      requesterRole: 'GA_STAFF',
      requesterGaId: 10,
    }),
    true,
  )
})

test('shared account list — USER 는 거부', () => {
  assert.equal(
    canAccessSharedAccountUserList({
      requesterRole: 'USER',
      requesterGaId: 10,
    }),
    false,
  )
})

test('shared account list — gaId 없으면 거부', () => {
  assert.equal(
    canAccessSharedAccountUserList({
      requesterRole: 'GA_ADMIN',
      requesterGaId: null,
    }),
    false,
  )
})

test('shared account access — GA_ADMIN 같은 GA + 대상 공유 ON 이면 허용', () => {
  assert.equal(
    canAccessSharedAccountManagement({
      requesterRole: 'GA_ADMIN',
      requesterGaId: 10,
      targetGaId: 10,
      targetShareEnabled: true,
    }),
    true,
  )
})

test('shared account access — GA_STAFF 같은 GA + 대상 공유 ON 이면 허용', () => {
  assert.equal(
    canAccessSharedAccountManagement({
      requesterRole: 'GA_STAFF',
      requesterGaId: 10,
      targetGaId: 10,
      targetShareEnabled: true,
    }),
    true,
  )
})

test('shared account access — 대상 공유 OFF 이면 거부', () => {
  assert.equal(
    canAccessSharedAccountManagement({
      requesterRole: 'GA_ADMIN',
      requesterGaId: 10,
      targetGaId: 10,
      targetShareEnabled: false,
    }),
    false,
  )
})

test('shared account access — 다른 GA 면 거부', () => {
  assert.equal(
    canAccessSharedAccountManagement({
      requesterRole: 'GA_ADMIN',
      requesterGaId: 10,
      targetGaId: 20,
      targetShareEnabled: true,
    }),
    false,
  )
})

test('shared account access — 권한 없는 역할(USER)은 거부', () => {
  assert.equal(
    canAccessSharedAccountManagement({
      requesterRole: 'USER',
      requesterGaId: 10,
      targetGaId: 10,
      targetShareEnabled: true,
    }),
    false,
  )
})

test('shared account access — GA 컨텍스트 없으면 거부', () => {
  assert.equal(
    canAccessSharedAccountManagement({
      requesterRole: 'GA_ADMIN',
      requesterGaId: null,
      targetGaId: 10,
      targetShareEnabled: true,
    }),
    false,
  )
})
