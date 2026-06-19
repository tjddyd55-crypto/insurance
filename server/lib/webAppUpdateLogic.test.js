import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isWebBuildUpdateAvailable,
  shouldPollForWebUpdate,
} from '../../shared/webAppUpdateLogic.js'

test('isWebBuildUpdateAvailable — detects buildId mismatch', () => {
  assert.equal(isWebBuildUpdateAvailable('111', '222'), true)
})

test('isWebBuildUpdateAvailable — same buildId is not an update', () => {
  assert.equal(isWebBuildUpdateAvailable('111', '111'), false)
})

test('isWebBuildUpdateAvailable — missing ids are ignored', () => {
  assert.equal(isWebBuildUpdateAvailable('', '222'), false)
  assert.equal(isWebBuildUpdateAvailable('111', ''), false)
  assert.equal(isWebBuildUpdateAvailable(null, undefined), false)
})

test('shouldPollForWebUpdate — skips hidden document', () => {
  assert.equal(shouldPollForWebUpdate('hidden'), false)
  assert.equal(shouldPollForWebUpdate('visible'), true)
})
