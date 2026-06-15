import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDynamicBoardPostGaFilter,
  contentScopeFromLegacyIsPublic,
  isGlobalContentScope,
  normalizeContentScope,
} from './newsletterBoardScope.js'
import { NEWSLETTER_BOARD_DUPLICATE_SLUG_SQL } from './newsletterBoardAdminSql.js'

test('content scope normalization', () => {
  assert.equal(normalizeContentScope('global'), 'global')
  assert.equal(normalizeContentScope('ga'), 'ga')
  assert.equal(contentScopeFromLegacyIsPublic(true), 'global')
  assert.equal(contentScopeFromLegacyIsPublic(false), 'ga')
  assert.equal(isGlobalContentScope('global'), true)
})

test('dynamic board post filter — global vs ga', () => {
  const globalBoard = { content_scope: 'global' }
  const gaBoard = { content_scope: 'ga' }
  assert.match(buildDynamicBoardPostGaFilter(globalBoard, 5, 3).sql, /ga_id IS NULL/i)
  assert.deepEqual(buildDynamicBoardPostGaFilter(gaBoard, 5, 3), {
    sql: 'AND n.ga_id = $3',
    params: [5],
  })
})

test('global menu duplicate slug SQL includes ga_id IS NULL', () => {
  assert.match(NEWSLETTER_BOARD_DUPLICATE_SLUG_SQL, /ga_id\s+IS\s+NULL/i)
})
