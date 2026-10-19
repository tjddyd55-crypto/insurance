import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ADVISOR_SHARE_DESCRIPTION_FALLBACK,
  buildAdvisorOgCardApiPath,
  buildAdvisorOgCardCacheVersion,
  buildAdvisorOgDescription,
  buildAdvisorOgImageCacheVersion,
  buildAdvisorOgTitle,
} from './publicAdvisorOgMeta.js'

test('og title uses the visible hero name and ignores the top label', () => {
  assert.equal(
    buildAdvisorOgTitle({
      displayName: '박성용',
      heroDisplayEyebrow: 'ONE FC',
      heroDisplayTitle: '박성용 FC',
      heroDisplayTitleVisible: true,
      heroDisplaySubtitle: '영진에셋 · 팀장',
    }),
    '박성용 FC',
  )
  assert.equal(
    buildAdvisorOgTitle({
      displayName: '박성용',
      heroDisplayEyebrow: 'MDRT',
      heroDisplayTitle: '박성용',
      heroDisplayTitleVisible: true,
      heroDisplaySubtitle: '법인 전문 컨설턴트',
    }),
    '박성용',
  )
  assert.equal(
    buildAdvisorOgTitle({
      displayName: '다른이름',
      heroDisplayTitle: '박성용 팀장',
      heroDisplayTitleVisible: true,
    }),
    '박성용 팀장',
  )
})

test('og title falls back to displayName when the hero title is hidden or empty', () => {
  assert.equal(
    buildAdvisorOgTitle({
      displayName: '박성용',
      heroDisplayEyebrow: 'ONE FC',
      heroDisplayTitle: '박성용 FC',
      heroDisplayTitleVisible: false,
    }),
    '박성용',
  )
  assert.equal(
    buildAdvisorOgTitle({
      displayName: '박성용',
      heroDisplayTitle: '   ',
      heroDisplayTitleVisible: true,
    }),
    '박성용',
  )
  assert.equal(buildAdvisorOgTitle({ displayName: '박성용' }).includes('ONE FC'), false)
})

test('og description uses headline, then a visible subtitle, then a generic line', () => {
  assert.equal(
    buildAdvisorOgDescription({
      headline: '한 줄 소개',
      heroDisplaySubtitle: '영진에셋 · 팀장',
      heroDisplaySubtitleVisible: true,
    }),
    '한 줄 소개',
  )
  assert.equal(
    buildAdvisorOgDescription({
      headline: '  ',
      heroDisplaySubtitle: '법인 전문 컨설턴트',
      heroDisplaySubtitleVisible: true,
    }),
    '법인 전문 컨설턴트',
  )
  const hidden = buildAdvisorOgDescription({
    headline: '',
    heroDisplaySubtitle: '영진에셋 · 팀장',
    heroDisplaySubtitleVisible: false,
  })
  assert.equal(hidden, ADVISOR_SHARE_DESCRIPTION_FALLBACK)
  assert.equal(hidden.includes('ONE FC'), false)
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
