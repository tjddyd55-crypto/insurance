import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatLinkedCardLabel } from './formatLinkedCardLabel.js'

describe('formatLinkedCardLabel', () => {
  it('shows label · owner · last4', () => {
    assert.equal(
      formatLinkedCardLabel({ label: '본인카드', cardOwnerName: '강톡호', cardNumberLast4: '5135' }),
      '본인카드 · 강톡호 · 끝 5135',
    )
  })

  it('omits empty label', () => {
    assert.equal(
      formatLinkedCardLabel({ label: '', cardOwnerName: '강톡호', cardNumberLast4: '5135' }),
      '강톡호 · 끝 5135',
    )
  })

  it('returns 연결 안 함 when card missing', () => {
    assert.equal(formatLinkedCardLabel(null), '연결 안 함')
  })
})
