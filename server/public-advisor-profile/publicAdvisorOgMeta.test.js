import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ADVISOR_OG_HEADLINE_FALLBACK,
  buildAdvisorOgCardApiPath,
  buildAdvisorOgCardCacheVersion,
  buildAdvisorOgDescription,
  buildAdvisorOgImageCacheVersion,
  buildAdvisorOgTitle,
} from './publicAdvisorOgMeta.js'

test('buildAdvisorOgTitle prefers visible hero title', () => {
  assert.equal(
    buildAdvisorOgTitle({ displayName: '홍길동', heroDisplayTitle: '박성용 FC', heroDisplayTitleVisible: true }),
    '박성용 FC | ONE FC',
  )
})

test('buildAdvisorOgTitle falls back to display name when hero title hidden', () => {
  assert.equal(
    buildAdvisorOgTitle({ displayName: '홍길동', heroDisplayTitle: '박성용 FC', heroDisplayTitleVisible: false }),
    '홍길동 | ONE FC',
  )
})

test('buildAdvisorOgDescription uses headline or short fallback', () => {
  assert.equal(buildAdvisorOgDescription({ headline: '한 줄 소개' }), '한 줄 소개')
  assert.equal(buildAdvisorOgDescription({ headline: '' }), ADVISOR_OG_HEADLINE_FALLBACK)
})

test('buildAdvisorOgCardApiPath appends cache version query', () => {
  const iso = '2026-04-01T00:00:00.000Z'
  assert.equal(
    buildAdvisorOgCardApiPath('tjddyd55', iso),
    `/api/public/advisors/tjddyd55/og-card.png?v=${Date.parse(iso)}`,
  )
  assert.equal(buildAdvisorOgCardApiPath('slug', null), '/api/public/advisors/slug/og-card.png')
})

test('buildAdvisorOgImageCacheVersion normalizes dates and numbers', () => {
  assert.equal(buildAdvisorOgImageCacheVersion(1_700_000_000_000), '1700000000000')
  const d = new Date('2026-01-01T00:00:00.000Z')
  assert.equal(buildAdvisorOgImageCacheVersion(d), String(d.getTime()))
})

test('og cache version changes when the business card key or its media updatedAt changes', () => {
  const updatedAt = '2026-04-01T00:00:00.000Z'
  const keyA = 'insurance/advisor-public/user/business-card/front-a.jpg'
  const keyB = 'insurance/advisor-public/user/business-card/front-b.jpg'
  const versionA = buildAdvisorOgCardCacheVersion({
    profileUpdatedAt: updatedAt,
    businessCardFrontObjectKey: keyA,
  })
  const versionB = buildAdvisorOgCardCacheVersion({
    profileUpdatedAt: updatedAt,
    businessCardFrontObjectKey: keyB,
  })
  assert.notEqual(versionA, versionB)
  assert.equal(buildAdvisorOgCardApiPath('tjddyd55', versionA).includes(`?v=${versionA}`), true)

  const newerMedia = buildAdvisorOgCardCacheVersion({
    profileUpdatedAt: updatedAt,
    businessCardFrontObjectKey: keyA,
    businessCardMediaUpdatedAt: '2026-05-01T00:00:00.000Z',
  })
  assert.notEqual(newerMedia, versionA)
  assert.ok(newerMedia.startsWith(String(Date.parse('2026-05-01T00:00:00.000Z'))))

  const noCard = buildAdvisorOgCardCacheVersion({ profileUpdatedAt: updatedAt, businessCardFrontObjectKey: '' })
  assert.equal(noCard, String(Date.parse(updatedAt)))
})
