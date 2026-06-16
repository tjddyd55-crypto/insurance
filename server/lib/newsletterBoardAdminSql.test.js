import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GA_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL,
  GA_ADMIN_NEWSLETTER_BOARD_SOFT_DELETE_SQL,
} from './newsletterBoardAdminSql.js'

test('GA admin delete SQL scopes to board_scope=ga and owner_ga_id', () => {
  assert.match(GA_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL, /board_scope\s*=\s*'ga'/i)
  assert.match(GA_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL, /owner_ga_id\s*=\s*\$2/i)
  assert.match(GA_ADMIN_NEWSLETTER_BOARD_SOFT_DELETE_SQL, /board_scope\s*=\s*'ga'/i)
  assert.match(GA_ADMIN_NEWSLETTER_BOARD_SOFT_DELETE_SQL, /owner_ga_id\s*=\s*\$2/i)
})
