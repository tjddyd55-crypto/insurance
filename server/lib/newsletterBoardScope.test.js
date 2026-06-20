import test from 'node:test'
import assert from 'node:assert/strict'
import {
  boardScopeFromBoard,
  buildDynamicBoardPostGaFilter,
  canUserAccessBoardMenu,
  contentScopeFromLegacyIsPublic,
  isGlobalBoardScope,
  isGlobalContentScope,
  normalizeBoardScope,
  normalizeContentScope,
  normalizeNewsletterBoardSlug,
} from './newsletterBoardScope.js'
import {
  GA_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL,
  GLOBAL_NEWSLETTER_BOARD_DUPLICATE_SLUG_SQL,
  NEWSLETTER_BOARDS_VISIBLE_LIST_SQL,
} from './newsletterBoardAdminSql.js'

test('board scope normalization', () => {
  assert.equal(normalizeNewsletterBoardSlug('더도움노무사'), '더도움노무사')
  assert.equal(normalizeBoardScope('global'), 'global')
  assert.equal(normalizeBoardScope('ga'), 'ga')
  assert.equal(normalizeBoardScope('system'), 'system')
  assert.equal(boardScopeFromBoard({ board_scope: 'global' }), 'global')
  assert.equal(boardScopeFromBoard({ content_scope: 'global' }), 'global')
  assert.equal(contentScopeFromLegacyIsPublic(true), 'global')
  assert.equal(isGlobalContentScope('global'), true)
  assert.equal(isGlobalBoardScope({ board_scope: 'global' }), true)
})

test('dynamic board post filter — global vs ga owner', () => {
  const globalBoard = { board_scope: 'global' }
  const gaBoard = { board_scope: 'ga', owner_ga_id: 12 }
  assert.match(buildDynamicBoardPostGaFilter(globalBoard, 5, 3).sql, /ga_id IS NULL/i)
  assert.deepEqual(buildDynamicBoardPostGaFilter(gaBoard, 5, 3), {
    sql: 'AND n.ga_id = $3',
    params: [12],
  })
})

test('canUserAccessBoardMenu — ga owner match', () => {
  assert.equal(canUserAccessBoardMenu({ board_scope: 'global' }, 3), true)
  assert.equal(canUserAccessBoardMenu({ board_scope: 'ga', owner_ga_id: 3 }, 3), true)
  assert.equal(canUserAccessBoardMenu({ board_scope: 'ga', owner_ga_id: 3 }, 4), false)
  assert.equal(canUserAccessBoardMenu({ board_scope: 'ga', owner_ga_id: null }, 4), false)
})

test('visible list SQL — strict ga owner, no NULL owner', () => {
  assert.match(NEWSLETTER_BOARDS_VISIBLE_LIST_SQL, /owner_ga_id\s*=\s*\$1/i)
  assert.doesNotMatch(NEWSLETTER_BOARDS_VISIBLE_LIST_SQL, /owner_ga_id\s+IS\s+NULL/i)
})

test('global duplicate slug SQL uses board_scope', () => {
  assert.match(GLOBAL_NEWSLETTER_BOARD_DUPLICATE_SLUG_SQL, /board_scope\s*=\s*'global'/i)
})

test('GA admin board lookup scopes owner ga', () => {
  assert.match(GA_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL, /owner_ga_id\s*=\s*\$2/i)
})
