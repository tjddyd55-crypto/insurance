import test from 'node:test'
import assert from 'node:assert/strict'
import {
  sqlHasNewsletterBoardTenantVisibilityScope,
  sqlHasUserOwnershipScope,
} from './dbSafeQuery.js'
import {
  GA_ADMIN_NEWSLETTER_BOARDS_LIST_SQL,
  NEWSLETTER_BOARD_BY_SLUG_TENANT_SQL,
  NEWSLETTER_BOARDS_VISIBLE_LIST_SQL,
} from '../lib/newsletterBoardAdminSql.js'

test('user ownership scope — insurance contacts GENERAL list SQL approved', () => {
  assert.equal(
    sqlHasUserOwnershipScope(`
      SELECT * FROM insurance_contacts
      WHERE user_id = $1 AND owner_scope = $2
      ORDER BY sort_order ASC, id ASC
    `),
    true,
  )
})

test('user ownership scope — user_id without owner_scope rejected', () => {
  assert.equal(
    sqlHasUserOwnershipScope(`
      SELECT * FROM insurance_contacts WHERE user_id = $1
    `),
    false,
  )
})

test('newsletter board visibility scope — visible list SQL approved', () => {
  assert.equal(sqlHasNewsletterBoardTenantVisibilityScope(NEWSLETTER_BOARDS_VISIBLE_LIST_SQL), true)
})

test('newsletter board visibility scope — slug tenant SQL approved', () => {
  assert.equal(sqlHasNewsletterBoardTenantVisibilityScope(NEWSLETTER_BOARD_BY_SLUG_TENANT_SQL), true)
})

test('newsletter board visibility scope — GA admin list SQL approved', () => {
  assert.equal(sqlHasNewsletterBoardTenantVisibilityScope(GA_ADMIN_NEWSLETTER_BOARDS_LIST_SQL), true)
})

test('newsletter board visibility scope — NULL owner ga rejected', () => {
  assert.equal(
    sqlHasNewsletterBoardTenantVisibilityScope(`
      SELECT * FROM newsletter_boards b
      WHERE b.board_scope = 'ga'
        AND (b.owner_ga_id IS NULL OR b.owner_ga_id = $1)
    `),
    false,
  )
})

test('newsletter board visibility scope — owner_ga_id without board_scope ga rejected', () => {
  assert.equal(
    sqlHasNewsletterBoardTenantVisibilityScope(`
      SELECT * FROM newsletter_boards WHERE owner_ga_id = $1
    `),
    false,
  )
})
