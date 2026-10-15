import assert from 'node:assert/strict'
import test from 'node:test'
import {
  READABLE_NEWSLETTER_BOARD_JOIN,
  READABLE_NEWSLETTER_KIND_SQL,
  normalizeNewsletterSourceKind,
  readableNewsletterWhere,
} from './newsletterReadableSources.js'
import { sqlHasNewsletterBoardTenantVisibilityScope } from '../utils/dbSafeQuery.js'

test('t306 readable sources: GA boards are bound to the session GA param, posts to the board owner', () => {
  const sql = readableNewsletterWhere('$1')
  assert.match(sql, /nb\.board_scope = 'ga' AND nb\.owner_ga_id = \$1/)
  assert.match(READABLE_NEWSLETTER_BOARD_JOIN, /b\.board_scope = 'ga' AND b\.owner_ga_id IS NOT NULL AND n\.ga_id = b\.owner_ga_id/)
  // 공용(global/system) 보드 글은 ga_id NULL 만
  assert.match(READABLE_NEWSLETTER_BOARD_JOIN, /b\.board_scope IN \('global', 'system'\) AND n\.ga_id IS NULL/)
  // 원수사는 자기 GA 행 + INSURER 채널 + 동적 보드 표식 제외 (소식지 메인 원수사 피드와 동일)
  assert.match(sql, /n\.ga_id = \$1\s+AND COALESCE\(NULLIF\(TRIM\(n\.payload->>'newsChannel'\), ''\), 'INSURER'\) = 'INSURER'/)
  assert.match(sql, /newsletterBoardId'\), ''\) IS NULL/)
  assert.match(sql, /n\.status = 'PUBLISHED'/)
  assert.match(sql, /n\.deleted_at IS NULL/)
  assert.match(sql, /customerVisible/)
})

test('t306 readable sources: board post match mirrors the newsletter main feed (no channel/name hardcoding)', () => {
  // 손해사정사 채널 보드는 system_key 로 판별, 나머지 보드는 newsletterBoardId 매칭 (newsChannel 무관)
  assert.match(READABLE_NEWSLETTER_BOARD_JOIN, /system_key/)
  assert.match(READABLE_NEWSLETTER_BOARD_JOIN, /b\.id = NULLIF\(TRIM\(n\.payload->>'newsletterBoardId'\), ''\)/)
  assert.doesNotMatch(READABLE_NEWSLETTER_BOARD_JOIN, /'BOARD', 'DYNAMIC_BOARD'/)
  assert.match(READABLE_NEWSLETTER_BOARD_JOIN, /b\.is_deleted = false/)
  assert.match(READABLE_NEWSLETTER_BOARD_JOIN, /COALESCE\(b\.is_active, true\) = true/)
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
