import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildNewsletterAuthorSnapshotFromWriter,
  resolveNewsletterPostAuthorLabel,
  resolveNewsletterRowAuthorDisplay,
} from './newsletterPostAuthorLabel.js'

describe('resolveNewsletterPostAuthorLabel', () => {
  it('prefers organization · author name', () => {
    assert.equal(
      resolveNewsletterPostAuthorLabel({
        organizationName: '영진',
        authorName: '홍길동',
        boardLabel: '테스트',
        legacyAuthorLabel: '테스트',
      }),
      '영진 · 홍길동',
    )
  })

  it('never falls back to board label', () => {
    assert.equal(
      resolveNewsletterPostAuthorLabel({
        boardLabel: '테스트',
        legacyAuthorLabel: '테스트',
      }),
      '—',
    )
  })

  it('uses loginId when name missing', () => {
    assert.equal(
      resolveNewsletterPostAuthorLabel({
        loginId: 'staff02',
        boardLabel: '테스트',
      }),
      'staff02',
    )
  })
})

describe('buildNewsletterAuthorSnapshotFromWriter', () => {
  it('builds snapshot from writer account', () => {
    const snap = buildNewsletterAuthorSnapshotFromWriter(
      {
        id: 'w1',
        name: '홍길동',
        organizationName: '영진',
        loginId: 'staff02',
      },
      '테스트',
    )
    assert.equal(snap.authorDisplayName, '영진 · 홍길동')
    assert.equal(snap.authorName, '홍길동')
    assert.equal(snap.authorOrganizationName, '영진')
  })
})

describe('resolveNewsletterRowAuthorDisplay', () => {
  it('overrides board-label insurerName when writer join exists', () => {
    const resolved = resolveNewsletterRowAuthorDisplay({
      payload: {
        dynamicBoardSlug: 'test',
        insurerCode: 'BOARD',
        insurerName: '테스트',
        boardLabel: '테스트',
        publisherId: 'w1',
      },
      companyNameSnapshot: '테스트',
      writerName: '홍길동',
      writerOrganizationName: '영진',
      writerLoginId: 'staff02',
      boardLabel: '테스트',
    })
    assert.equal(resolved.insurerName, '영진 · 홍길동')
    assert.equal(resolved.authorDisplayName, '영진 · 홍길동')
    assert.equal(resolved.boardLabel, '테스트')
  })

  it('keeps insurer company name for non-board posts', () => {
    const resolved = resolveNewsletterRowAuthorDisplay({
      payload: {
        insurerCode: 'SAMSUNG',
        insurerName: '삼성화재',
        newsChannel: 'INSURER',
      },
      companyNameSnapshot: '삼성화재',
    })
    assert.equal(resolved.insurerName, '삼성화재')
  })
})
