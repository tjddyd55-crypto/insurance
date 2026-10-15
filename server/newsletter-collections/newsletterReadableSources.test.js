import assert from 'node:assert/strict'
import test from 'node:test'
import {
  READABLE_NEWSLETTER_BOARD_JOIN,
  READABLE_NEWSLETTER_KIND_SQL,
  normalizeNewsletterSourceKind,
  readableNewsletterWhere,
} from './newsletterReadableSources.js'
import { sqlHasNewsletterBoardTenantVisibilityScope } from '../utils/dbSafeQuery.js'

test('t299 readable sources: GA branch is bound to the session GA param on both board owner and post', () => {
  const sql = readableNewsletterWhere('$1')
  assert.match(sql, /nb\.board_scope = 'ga'\s+AND nb\.owner_ga_id = \$1\s+AND n\.ga_id = \$1/)
  // 공용 글은 ga_id NULL 만
  assert.match(sql, /nb\.board_scope = 'global'\s+AND n\.ga_id IS NULL/)
  // 원수사는 자기 GA 행 + INSURER 채널 + 동적 보드 표식 제외
  assert.match(sql, /n\.ga_id = \$1\s+AND COALESCE\(NULLIF\(TRIM\(n\.payload->>'newsChannel'\), ''\), 'INSURER'\) = 'INSURER'/)
  assert.match(sql, /newsletterBoardId'\), ''\) IS NULL/)
  // 공통 가드
  assert.match(sql, /n\.status = 'PUBLISHED'/)
  assert.match(sql, /n\.deleted_at IS NULL/)
  assert.match(sql, /customerVisible/)
  // owner 가 NULL 인 GA 보드 허용 금지
  assert.doesNotMatch(sql, /owner_ga_id\s+IS\s+NULL/i)
})

test('t299 readable sources: system boards (손해사정사) are never joined', () => {
  assert.match(READABLE_NEWSLETTER_BOARD_JOIN, /nb\.board_scope IN \('global', 'ga'\)/)
  assert.match(READABLE_NEWSLETTER_BOARD_JOIN, /nb\.is_deleted = false/)
  assert.match(READABLE_NEWSLETTER_KIND_SQL, /'PUBLIC'/)
})

test('t299 readable sources: passes safeQuery newsletter_boards tenant scope check', () => {
  const sql = `SELECT n.id FROM insurance_company_newsletters n ${READABLE_NEWSLETTER_BOARD_JOIN} WHERE ${readableNewsletterWhere('$1')}`
  assert.equal(sqlHasNewsletterBoardTenantVisibilityScope(sql), true)
})

test('t299 normalizeNewsletterSourceKind', () => {
  assert.equal(normalizeNewsletterSourceKind('ga'), 'GA')
  assert.equal(normalizeNewsletterSourceKind('PUBLIC'), 'PUBLIC')
  assert.equal(normalizeNewsletterSourceKind('BOARD'), null)
})
