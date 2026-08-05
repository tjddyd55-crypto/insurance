import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildNewsletterBoardPostMatch,
  sqlMatchPostsByNewsletterBoardId,
} from './newsletterBoardPostScope.js'

test('sqlMatchPostsByNewsletterBoardId uses newsletterBoardId not slug', () => {
  const match = sqlMatchPostsByNewsletterBoardId('n', 1)
  assert.match(match.sql, /newsletterBoardId/)
  assert.doesNotMatch(match.sql, /dynamicBoardSlug/)
  assert.doesNotMatch(match.sql, /board\.slug|board_slug/)
})

test('buildNewsletterBoardPostMatch scopes dynamic boards by board id', () => {
  const match = buildNewsletterBoardPostMatch(
    { id: 'board-b', slug: '테스트', board_scope: 'global', system_key: null },
    { boardIdParamIndex: 1 },
  )
  assert.equal(match.usesBoardId, true)
  assert.deepEqual(match.params, ['board-b'])
  assert.match(match.sql, /newsletterBoardId/)
  assert.doesNotMatch(match.sql, /dynamicBoardSlug/)
})

test('buildNewsletterBoardPostMatch keeps loss-adjuster newsChannel contract', () => {
  const match = buildNewsletterBoardPostMatch(
    { id: 'la-1', slug: 'system-loss-adjuster', board_scope: 'ga', system_key: 'LOSS_ADJUSTER' },
    { lossAdjusterChannelParamIndex: 1 },
  )
  assert.equal(match.usesBoardId, false)
  assert.deepEqual(match.params, ['LOSS_ADJUSTER'])
  assert.match(match.sql, /newsChannel/)
})
