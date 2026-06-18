import test from 'node:test'
import assert from 'node:assert/strict'
import { boardWriterCompanySlug, buildDynamicBoardPayload } from './boardWriterNewsletters.js'

test('boardWriterCompanySlug prefixes board slug', () => {
  assert.equal(boardWriterCompanySlug({ slug: 'notice' }), 'board-notice')
})

test('buildDynamicBoardPayload marks global posts', () => {
  const payload = buildDynamicBoardPayload({ slug: 'notice', label: '공지', board_scope: 'global' }, 'writer-1', 'PUBLISHED')
  assert.equal(payload.dynamicBoardSlug, 'notice')
  assert.equal(payload.contentScope, 'global')
  assert.equal(payload.publisherId, 'writer-1')
  assert.equal(payload.insurerSlug, 'board-notice')
})
