import test from 'node:test'
import assert from 'node:assert/strict'
import { buildR2PresignedPutHeaders } from './consentStorage.js'

test('buildR2PresignedPutHeaders includes Cache-Control when set', () => {
  assert.deepEqual(buildR2PresignedPutHeaders('public, max-age=31536000'), {
    'Cache-Control': 'public, max-age=31536000',
  })
})

test('buildR2PresignedPutHeaders empty when no cache control', () => {
  assert.deepEqual(buildR2PresignedPutHeaders(''), {})
  assert.deepEqual(buildR2PresignedPutHeaders(null), {})
})
