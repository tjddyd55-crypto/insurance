import test from 'node:test'
import assert from 'node:assert/strict'
import { boardWriterCompanySlug, buildBoardWriterPostGaFilter, buildDynamicBoardPayload } from './boardWriterNewsletters.js'
import { buildDynamicBoardPostGaFilter } from './newsletterBoardScope.js'

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

test('writer and portal read filters align for global and ga boards', () => {
  const globalBoard = { board_scope: 'global', slug: 'notice' }
  const gaBoard = { board_scope: 'ga', owner_ga_id: 12, slug: 'team' }

  assert.match(buildBoardWriterPostGaFilter(globalBoard, null).sql, /ga_id IS NULL/i)
  assert.match(buildDynamicBoardPostGaFilter(globalBoard, 5, 3).sql, /ga_id IS NULL/i)

  assert.deepEqual(buildBoardWriterPostGaFilter(gaBoard, 12).params, [12])
  assert.deepEqual(buildDynamicBoardPostGaFilter(gaBoard, 5, 3).params, [12])
})
