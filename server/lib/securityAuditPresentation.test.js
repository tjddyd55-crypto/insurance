import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildAuditLogSummary,
  enrichSecurityAuditLogRow,
  maskSensitiveAuditMeta,
  resolveAuditLogActionLabel,
  resolveAuditLogCategory,
  resolveAuditLogRoleLabel,
  resolveAuditTargetLabel,
} from './securityAuditPresentation.js'

test('resolveAuditLogActionLabel maps known actions and falls back', () => {
  assert.equal(resolveAuditLogActionLabel('login_success'), '로그인 성공')
  assert.equal(resolveAuditLogActionLabel('LOGIN_FAILED'), '로그인 실패')
  assert.equal(resolveAuditLogActionLabel('unknown_action'), '기타 작업')
})

test('resolveAuditLogRoleLabel maps roles', () => {
  assert.equal(resolveAuditLogRoleLabel('SUPER_ADMIN'), '최고관리자')
  assert.equal(resolveAuditLogRoleLabel('USER'), '일반 유저')
})

test('resolveAuditTargetLabel maps auth target by role', () => {
  assert.equal(resolveAuditTargetLabel('auth', 'uuid', 'SUPER_ADMIN'), '관리자 계정')
  assert.equal(resolveAuditTargetLabel('auth', 'uuid', 'USER'), '사용자 계정')
})

test('buildAuditLogSummary creates human readable sentences', () => {
  assert.equal(
    buildAuditLogSummary('login_success', { username: 'admin' }, '로그인 성공', 'admin'),
    'admin 계정으로 로그인',
  )
  assert.equal(
    buildAuditLogSummary('notice_update', { noticeTitle: '공지사항 테스트' }, '공지 수정', 'admin'),
    '공지사항 테스트 공지 관련 작업',
  )
})

test('maskSensitiveAuditMeta hides secrets', () => {
  const masked = maskSensitiveAuditMeta({ username: 'admin', password: 'secret', token: 'abc' })
  assert.equal(masked.username, 'admin')
  assert.equal(masked.password, '***')
  assert.equal(masked.token, '***')
})

test('enrichSecurityAuditLogRow adds presentation fields', () => {
  const row = enrichSecurityAuditLogRow({
    id: 1,
    actor_user_id: 'cf2820f3-de82-4cdc-8e44-b0dd36a1b27a',
    actor_role: 'SUPER_ADMIN',
    action: 'login_success',
    target_type: 'auth',
    target_id: 'cf2820f3-de82-4cdc-8e44-b0dd36a1b27a',
    ga_id: 1,
    company_id: null,
    meta: { username: 'admin' },
    created_at: '2026-06-28T08:13:00.000Z',
    actor_username: 'admin',
    actor_display_name: 'admin',
  })

  assert.equal(row.actionLabel, '로그인 성공')
  assert.equal(row.roleLabel, '최고관리자')
  assert.equal(row.targetLabel, '관리자 계정')
  assert.equal(row.summary, 'admin 계정으로 로그인')
  assert.equal(row.category, 'login')
})

test('resolveAuditLogCategory groups actions', () => {
  assert.equal(resolveAuditLogCategory('login_success'), 'login')
  assert.equal(resolveAuditLogCategory('notice_create'), 'notice')
  assert.equal(resolveAuditLogCategory('PLATFORM_TENANT_CREATE'), 'system')
})
