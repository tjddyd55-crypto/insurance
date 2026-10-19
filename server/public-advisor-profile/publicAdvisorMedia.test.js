import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ADVISOR_PUBLIC_OBJECT_PREFIX,
  advisorPublicCdnUrl,
  buildAdvisorPublicObjectKey,
  isBlockedAdvisorBusinessCardBackKind,
  normalizeAdvisorPublicMediaKind,
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

test('paper business card accepts front only', () => {
  assert.equal(normalizeAdvisorPublicMediaKind('business-card-front'), 'business-card-front')
  assert.equal(normalizeAdvisorPublicMediaKind('business_card_front'), 'business-card-front')
  assert.equal(normalizeAdvisorPublicMediaKind('business-card-back'), null)
  assert.equal(normalizeAdvisorPublicMediaKind('business_card_back'), null)
  assert.equal(isBlockedAdvisorBusinessCardBackKind('business-card-back'), true)
  const front = buildAdvisorPublicObjectKey('user-abc', 'business-card-front', 'card.png')
  assert.match(front, /\/business-card\/front-/)
  assert.throws(() => buildAdvisorPublicObjectKey('user-abc', 'business-card-back', 'card.png'))
})

test('advisorPublicCdnUrl builds CDN path under insurance/', () => {
  const url = advisorPublicCdnUrl('insurance/advisor-public/u1/profile/a.png')
  assert.match(url, /\/insurance\/advisor-public\/u1\/profile\/a\.png$/)
})
