import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildNewsletterBoardDuplicateSlugSql,
  GA_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL,
  GA_ADMIN_NEWSLETTER_BOARD_SOFT_DELETE_SQL,
  SUPER_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL,
} from './newsletterBoardAdminSql.js'

test('공용 게시판 중복 검사 SQL에 ga_id IS NULL 스코프가 있다', () => {
  const { sql, params } = buildNewsletterBoardDuplicateSlugSql(true)
  assert.match(sql, /ga_id\s+IS\s+NULL/i)
  assert.match(sql, /is_public\s*=\s*true/i)
  assert.deepEqual(params('test-board'), ['test-board'])
})

test('GA 전용 게시판 중복 검사 SQL에 ga_id = tenantGaId 스코프가 있다', () => {
  const { sql, params } = buildNewsletterBoardDuplicateSlugSql(false)
  assert.match(sql, /ga_id\s*=\s*\$2::int/i)
  assert.match(sql, /is_public\s*=\s*false/i)
  assert.deepEqual(params('test-board', 42), ['test-board', 42])
})

test('GA 관리자 삭제 조회/수정 SQL에 ga_id 스코프가 있다', () => {
  assert.match(GA_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL, /ga_id\s*=\s*\$2::int/i)
  assert.match(GA_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL, /is_public\s*=\s*false/i)
  assert.match(GA_ADMIN_NEWSLETTER_BOARD_SOFT_DELETE_SQL, /ga_id\s*=\s*\$2::int/i)
  assert.match(GA_ADMIN_NEWSLETTER_BOARD_SOFT_DELETE_SQL, /is_public\s*=\s*false/i)
})

test('SUPER_ADMIN 삭제 조회 SQL은 id 기반 전역 조회', () => {
  assert.match(SUPER_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL, /WHERE id = \$1/i)
  assert.doesNotMatch(SUPER_ADMIN_NEWSLETTER_BOARD_BY_ID_SQL, /ga_id\s*=\s*\$/i)
})
