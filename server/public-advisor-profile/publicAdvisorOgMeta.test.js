import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ADVISOR_OG_HEADLINE_FALLBACK,
  buildAdvisorOgDescription,
  buildAdvisorOgTitle,
} from './publicAdvisorOgMeta.js'

test('buildAdvisorOgTitle uses name and title suffix', () => {
  assert.equal(buildAdvisorOgTitle({ displayName: '홍길동', titleLabel: 'FC' }), '홍길동 FC | ONE FC')
})

test('buildAdvisorOgDescription joins affiliation and headline', () => {
  assert.equal(
    buildAdvisorOgDescription({ gaName: '영진에셋', teamName: '테스트팀', headline: '한 줄 소개' }),
    '영진에셋 · 테스트팀 · 한 줄 소개',
  )
})

test('buildAdvisorOgDescription uses fallback when headline empty', () => {
  assert.equal(
    buildAdvisorOgDescription({ gaName: '영진에셋', teamName: '', headline: '' }),
    `영진에셋 · ${ADVISOR_OG_HEADLINE_FALLBACK}`,
  )
})
