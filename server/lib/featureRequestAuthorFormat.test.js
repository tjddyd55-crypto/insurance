import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatFeatureRequestAuthor,
  formatFeatureRequestCommentAuthor,
} from '../../src/features/feature-request/formatFeatureRequestAuthor.js'

test('formatFeatureRequestAuthor prefers ga / name over login id', () => {
  assert.equal(
    formatFeatureRequestAuthor({
      gaName: '영진에셋',
      userName: '홍길동',
      username: 'cas5555',
    }),
    '영진에셋 / 홍길동',
  )
})

test('formatFeatureRequestAuthor falls back to ga / login id', () => {
  assert.equal(
    formatFeatureRequestAuthor({
      gaName: '영진에셋',
      username: 'cas5555',
    }),
    '영진에셋 / cas5555',
  )
})

test('formatFeatureRequestAuthor falls back to name then login id', () => {
  assert.equal(formatFeatureRequestAuthor({ userName: '홍길동' }), '홍길동')
  assert.equal(formatFeatureRequestAuthor({ username: 'cas5555' }), 'cas5555')
  assert.equal(formatFeatureRequestAuthor({}), '—')
})

test('formatFeatureRequestCommentAuthor labels admin replies', () => {
  assert.equal(
    formatFeatureRequestCommentAuthor({
      authorRole: 'admin',
      authorGaName: '영진에셋',
      authorDisplayName: '관리자',
    }),
    '담당자 · 영진에셋 / 관리자',
  )
})
