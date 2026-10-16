import assert from 'node:assert/strict'
import test from 'node:test'

import { assertAdvisorPublicObjectKeyOwned, buildAdvisorPublicObjectKey } from './publicAdvisorMedia.js'
import { GALLERY_MAX } from './publicAdvisorProfileService.js'

test('GALLERY_MAX is 6', () => {
  assert.equal(GALLERY_MAX, 6)
})

test('assertAdvisorPublicObjectKeyOwned accepts owned keys only', () => {
  const uid = 'user-123'
  const key = buildAdvisorPublicObjectKey(uid, 'gallery', 'photo.jpg')
  assert.equal(assertAdvisorPublicObjectKeyOwned(uid, key), true)
  assert.equal(assertAdvisorPublicObjectKeyOwned(uid, 'other/path.jpg'), false)
  assert.equal(assertAdvisorPublicObjectKeyOwned(uid, `advisor-public/${uid}/../escape.jpg`), false)
})
