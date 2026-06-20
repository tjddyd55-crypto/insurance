import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyNewsletterBoardAccess,
  isGaOnlyBoardSlugForTenant,
  listNewsletterBoardsBySlug,
  normalizeNewsletterBoardTenantGaId,
  pickAccessibleNewsletterBoard,
} from './newsletterBoardAccess.js'
import { NEWSLETTER_BOARD_BY_SLUG_TENANT_SQL } from './newsletterBoardAdminSql.js'
import { normalizeNewsletterBoardSlug } from './newsletterBoardScope.js'
import { sqlHasNewsletterBoardTenantVisibilityScope } from '../utils/dbSafeQuery.js'

test('normalizeNewsletterBoardSlug lowercases and keeps hangul', () => {
  assert.equal(normalizeNewsletterBoardSlug('더도움노무사'), '더도움노무사')
  assert.equal(normalizeNewsletterBoardSlug(' Global Notice '), 'global-notice')
})

test('pickAccessibleNewsletterBoard prefers global when slug collides', () => {
  const globalBoard = { id: 'g1', slug: 'notice', board_scope: 'global', owner_ga_id: null }
  const gaBoard = { id: 'a1', slug: 'notice', board_scope: 'ga', owner_ga_id: 7 }
  const rows = [gaBoard, globalBoard]

  assert.equal(pickAccessibleNewsletterBoard(rows, 7)?.id, 'g1')
  assert.equal(pickAccessibleNewsletterBoard(rows, null)?.id, 'g1')
})

test('pickAccessibleNewsletterBoard allows ga owner only for ga board', () => {
  const gaBoard = { id: 'a1', slug: 'team', board_scope: 'ga', owner_ga_id: 7 }
  assert.equal(pickAccessibleNewsletterBoard([gaBoard], 7)?.id, 'a1')
  assert.equal(pickAccessibleNewsletterBoard([gaBoard], 3), null)
})

test('classifyNewsletterBoardAccess — public account on ga-only slug', () => {
  const gaBoard = { id: 'a1', slug: 'team', board_scope: 'ga', owner_ga_id: 7 }
  assert.equal(classifyNewsletterBoardAccess([gaBoard], 99), 'access_denied')
  assert.equal(isGaOnlyBoardSlugForTenant([gaBoard], 99), true)
})

test('classifyNewsletterBoardAccess — ga account on global slug', () => {
  const globalBoard = { id: 'g1', slug: 'notice', board_scope: 'global', owner_ga_id: null }
  assert.equal(classifyNewsletterBoardAccess([globalBoard], 7), null)
  assert.equal(pickAccessibleNewsletterBoard([globalBoard], 7)?.board_scope, 'global')
})

test('classifyNewsletterBoardAccess — missing slug', () => {
  assert.equal(classifyNewsletterBoardAccess([], 7), 'not_found')
})

test('NEWSLETTER_BOARD_BY_SLUG_TENANT_SQL passes safeQuery tenant visibility scope', () => {
  assert.equal(sqlHasNewsletterBoardTenantVisibilityScope(NEWSLETTER_BOARD_BY_SLUG_TENANT_SQL), true)
})

test('normalizeNewsletterBoardTenantGaId rejects invalid ids', () => {
  assert.equal(normalizeNewsletterBoardTenantGaId(null), null)
  assert.equal(normalizeNewsletterBoardTenantGaId(undefined), null)
  assert.equal(normalizeNewsletterBoardTenantGaId(0), null)
  assert.equal(normalizeNewsletterBoardTenantGaId(7), 7)
})

test('listNewsletterBoardsBySlug passes slug and tenantGaId to queryFn', async () => {
  let capturedSql = ''
  let capturedParams = []
  const executor = {}
  const queryFn = async (_executor, sql, params) => {
    capturedSql = sql
    capturedParams = params
    return { rows: [{ id: 'g1', slug: 'notice', board_scope: 'global', owner_ga_id: null }] }
  }
  const rows = await listNewsletterBoardsBySlug(executor, queryFn, 'Notice', 7)
  assert.equal(capturedSql, NEWSLETTER_BOARD_BY_SLUG_TENANT_SQL)
  assert.deepEqual(capturedParams, ['notice', 7])
  assert.equal(rows[0].id, 'g1')
})

test('listNewsletterBoardsBySlug binds null gaId for public/general tenant', async () => {
  let capturedParams = []
  await listNewsletterBoardsBySlug(
    {},
    async (_executor, _sql, params) => {
      capturedParams = params
      return { rows: [] }
    },
    '더도움노무사',
    null,
  )
  assert.deepEqual(capturedParams, ['더도움노무사', null])
})
