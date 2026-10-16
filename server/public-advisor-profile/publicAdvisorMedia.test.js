import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ADVISOR_PUBLIC_OBJECT_PREFIX,
  advisorPublicCdnUrl,
  buildAdvisorPublicObjectKey,
  normalizeAdvisorPublicObjectKeyForCdn,
} from './publicAdvisorMedia.js'

test('buildAdvisorPublicObjectKey uses insurance/advisor-public prefix', () => {
  const uid = 'user-abc'
  const key = buildAdvisorPublicObjectKey(uid, 'profile', 'photo.jpg')
  assert.equal(key.startsWith(`${ADVISOR_PUBLIC_OBJECT_PREFIX}/${uid}/profile/`), true)
})

test('normalizeAdvisorPublicObjectKeyForCdn maps legacy advisor-public keys', () => {
  const legacy = 'advisor-public/u1/gallery/x.webp'
  assert.equal(
    normalizeAdvisorPublicObjectKeyForCdn(legacy),
    'insurance/advisor-public/u1/gallery/x.webp',
  )
})

test('advisorPublicCdnUrl builds CDN path under insurance/', () => {
  const url = advisorPublicCdnUrl('insurance/advisor-public/u1/profile/a.png')
  assert.match(url, /\/insurance\/advisor-public\/u1\/profile\/a\.png$/)
})
