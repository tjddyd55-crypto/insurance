import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  GLOBAL_NEWSLETTER_BOARD_DUPLICATE_SLUG_SQL,
  SUPER_ADMIN_NEWSLETTER_BOARDS_LIST_SQL,
} from './newsletterBoardAdminSql.js'
import { adminNewsletterBoardQuery } from './newsletterBoardAdminQuery.js'
import { sqlHasNewsletterBoardTenantVisibilityScope } from '../utils/dbSafeQuery.js'

describe('newsletter board admin query', () => {
  it('rejects non-newsletter_boards SQL', async () => {
    await assert.rejects(
      () => adminNewsletterBoardQuery({ query: async () => ({ rows: [] }) }, 'SELECT 1', []),
      /newsletter_boards/,
    )
  })

  it('uses systemQuery path for super admin list SQL', async () => {
    let capturedSql = ''
    const executor = {
      query: async (sql) => {
        capturedSql = sql
        return { rows: [{ id: 'b1', board_scope: 'global' }], rowCount: 1 }
      },
    }
    const result = await adminNewsletterBoardQuery(executor, SUPER_ADMIN_NEWSLETTER_BOARDS_LIST_SQL, [])
    assert.match(capturedSql, /newsletter_boards/)
    assert.equal(result.rowCount, 1)
  })

  it('documents why global duplicate check cannot use safeQuery', () => {
    assert.equal(sqlHasNewsletterBoardTenantVisibilityScope(GLOBAL_NEWSLETTER_BOARD_DUPLICATE_SLUG_SQL), false)
    assert.equal(sqlHasNewsletterBoardTenantVisibilityScope(SUPER_ADMIN_NEWSLETTER_BOARDS_LIST_SQL), false)
  })
})
