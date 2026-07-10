import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FEATURE_REQUEST_COMMENT_COUNT_SUBQUERY_SQL,
  FEATURE_REQUEST_COMMENT_INSERT_SQL,
  FEATURE_REQUEST_COMMENT_SELECT_SQL,
} from './featureRequestCommentsSql.js'
import { safeQuery } from '../utils/dbSafeQuery.js'

function sqlHasTenantGaFilter(sql) {
  return /\bga_id\b/i.test(String(sql))
}

test('feature request comment SELECT — ga_id scope required by safeQuery', () => {
  assert.equal(sqlHasTenantGaFilter(FEATURE_REQUEST_COMMENT_SELECT_SQL), true)
  assert.match(
    FEATURE_REQUEST_COMMENT_SELECT_SQL,
    /WHERE c\.feature_request_id = \$1\s+AND c\.ga_id = \$2/i,
  )
})

test('feature request comment SELECT — includes author display joins', () => {
  assert.match(FEATURE_REQUEST_COMMENT_SELECT_SQL, /LEFT JOIN users u ON u\.id = c\.author_user_id/i)
  assert.match(FEATURE_REQUEST_COMMENT_SELECT_SQL, /author_display_name/i)
  assert.match(FEATURE_REQUEST_COMMENT_SELECT_SQL, /author_ga_name/i)
})

test('feature request comment INSERT — parent ga_id enforced', () => {
  assert.equal(sqlHasTenantGaFilter(FEATURE_REQUEST_COMMENT_INSERT_SQL), true)
  assert.match(FEATURE_REQUEST_COMMENT_INSERT_SQL, /FROM feature_requests r/i)
  assert.match(FEATURE_REQUEST_COMMENT_INSERT_SQL, /WHERE r\.id = \$1\s+AND r\.ga_id = \$5/i)
})

test('feature request comment count subquery — ga_id aligned with parent', () => {
  assert.equal(sqlHasTenantGaFilter(FEATURE_REQUEST_COMMENT_COUNT_SUBQUERY_SQL), true)
  assert.match(FEATURE_REQUEST_COMMENT_COUNT_SUBQUERY_SQL, /c\.ga_id = fr\.ga_id/i)
})

test('feature request comment SELECT — passes safeQuery guard', async () => {
  let captured = null
  const pool = {
    query: async (sql, params) => {
      captured = { sql, params }
      return { rows: [], rowCount: 0 }
    },
  }
  await safeQuery(pool, FEATURE_REQUEST_COMMENT_SELECT_SQL, [42, 7])
  assert.equal(captured.params[0], 42)
  assert.equal(captured.params[1], 7)
})

test('feature request comment INSERT — wrong ga returns no row (defense in depth)', async () => {
  const pool = {
    query: async () => ({ rows: [], rowCount: 0 }),
  }
  const result = await safeQuery(pool, FEATURE_REQUEST_COMMENT_INSERT_SQL, [
    99,
    'admin-user',
    'admin1',
    '답변 내용',
    3,
  ])
  assert.equal(result.rowCount, 0)
})

test('legacy unscoped comment SELECT — rejected by safeQuery', async () => {
  const pool = { query: async () => ({ rows: [], rowCount: 0 }) }
  const legacySql = `
    SELECT id FROM feature_request_comments
    WHERE feature_request_id = $1
    LIMIT 500
  `
  await assert.rejects(
    () => safeQuery(pool, legacySql, [1]),
    /GA 필터 없는 쿼리 실행 금지/i,
  )
})
