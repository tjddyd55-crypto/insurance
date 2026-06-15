import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GA_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL,
  GA_ADMIN_NEWSLETTER_BOARD_SOFT_DELETE_SQL,
  NEWSLETTER_BOARD_DUPLICATE_SLUG_SQL,
  SUPER_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL,
} from './newsletterBoardAdminSql.js'

test('global menu duplicate slug SQL includes ga_id IS NULL', () => {
  assert.match(NEWSLETTER_BOARD_DUPLICATE_SLUG_SQL, /ga_id\s+IS\s+NULL/i)
})

test('GA admin delete SQL scopes to content_scope=ga global menu row', () => {
  assert.match(GA_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL, /content_scope\s*=\s*'ga'/i)
  assert.match(GA_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL, /ga_id\s+IS\s+NULL/i)
  assert.match(GA_ADMIN_NEWSLETTER_BOARD_SOFT_DELETE_SQL, /content_scope\s*=\s*'ga'/i)
})

test('SUPER_ADMIN delete lookup uses global menu row', () => {
  assert.match(SUPER_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL, /ga_id\s+IS\s+NULL/i)
})
