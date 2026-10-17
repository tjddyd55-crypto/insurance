import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ADVISOR_OG_HEADLINE_FALLBACK,
  buildAdvisorOgDescription,
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
