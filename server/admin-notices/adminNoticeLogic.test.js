import assert from 'node:assert/strict'
import test from 'node:test'
import {
  comparePopupNotices,
  derivePlainText,
  isActivePopupCandidate,
  isNoticeDismissedActive,
  normalizeContentBlocks,
} from './adminNoticeLogic.js'

test('normalizeContentBlocks accepts text and image blocks', () => {
  const blocks = normalizeContentBlocks([
    { type: 'text', text: '안내' },
    {
      type: 'image',
      storageKey: 'insurance/admin-notices/1/a.png',
      url: 'https://cdn.example/a.png',
      alt: '안내',
    },
  ])
  assert.equal(blocks.length, 2)
  assert.equal(blocks[0].type, 'text')
  assert.equal(blocks[1].type, 'image')
})

test('derivePlainText joins text blocks', () => {
  const plain = derivePlainText([
    { type: 'text', text: '첫 줄' },
    { type: 'image', url: 'https://x', storageKey: 'insurance/admin-notices/1/a.png' },
    { type: 'text', text: '둘째 줄' },
  ])
  assert.equal(plain, '첫 줄\n둘째 줄')
})

test('isActivePopupCandidate requires published popup in schedule', () => {
  const now = new Date('2026-06-28T03:00:00.000Z')
  assert.equal(
    isActivePopupCandidate(
      { status: 'published', showAsPopup: true, startsAt: null, endsAt: null },
      now,
    ),
    true,
  )
  assert.equal(
    isActivePopupCandidate(
      { status: 'published', showAsPopup: true, startsAt: '2026-06-27T00:00:00.000Z', endsAt: null },
      now,
    ),
    true,
  )
  assert.equal(
    isActivePopupCandidate({ status: 'draft', showAsPopup: true, startsAt: null, endsAt: null }, now),
    false,
  )
  assert.equal(
    isActivePopupCandidate(
      { status: 'published', showAsPopup: true, startsAt: '2026-06-29T00:00:00.000Z', endsAt: null },
      now,
    ),
    false,
  )
  assert.equal(
    isActivePopupCandidate(
      { status: 'published', showAsPopup: true, startsAt: null, endsAt: '2026-06-27T00:00:00.000Z' },
      now,
    ),
    false,
  )
})

test('comparePopupNotices prefers higher priority and latest update', () => {
  const sorted = [
    { id: 1, popupPriority: 1, updatedAt: '2026-06-20T00:00:00.000Z' },
    { id: 2, popupPriority: 3, updatedAt: '2026-06-21T00:00:00.000Z' },
    { id: 3, popupPriority: 3, updatedAt: '2026-06-22T00:00:00.000Z' },
  ].sort(comparePopupNotices)
  assert.equal(sorted[0].id, 3)
})

test('isNoticeDismissedActive respects until and forever flags', () => {
  const now = new Date('2026-06-28T12:00:00.000Z')
  assert.equal(
    isNoticeDismissedActive({ dismissedUntil: '2026-06-28T23:59:59.999+09:00', dismissedForever: false }, now),
    true,
  )
  assert.equal(
    isNoticeDismissedActive({ dismissedUntil: '2026-06-27T23:59:59.999+09:00', dismissedForever: false }, now),
    false,
  )
  assert.equal(isNoticeDismissedActive({ dismissedForever: true }, now), true)
})
