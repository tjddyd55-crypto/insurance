import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isUuid,
  mapPublicInquiryAdminRow,
  parsePublicInquiryAdminListQuery,
  parsePublicInquiryAdminPatchBody,
  resolveInquiryResolvedAt,
  PUBLIC_INQUIRY_ADMIN_STATUSES,
} from './publicInquiryAdminValidation.js'

test('PUBLIC_INQUIRY_ADMIN_STATUSES covers workflow states', () => {
  assert.deepEqual([...PUBLIC_INQUIRY_ADMIN_STATUSES], [
    'NEW',
    'CHECKING',
    'CONTACTED',
    'COMPLETED',
    'SPAM',
  ])
})

test('isUuid accepts standard UUID', () => {
  assert.equal(isUuid('550e8400-e29b-41d4-a716-446655440000'), true)
  assert.equal(isUuid('not-a-uuid'), false)
  assert.equal(isUuid(''), false)
})

test('parsePublicInquiryAdminListQuery defaults pageSize to 20', () => {
  const r = parsePublicInquiryAdminListQuery({})
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal(r.value.page, 1)
    assert.equal(r.value.pageSize, 20)
    assert.equal(r.value.status, null)
    assert.equal(r.value.q, null)
  }
})

test('parsePublicInquiryAdminListQuery rejects bad status and type', () => {
  const badStatus = parsePublicInquiryAdminListQuery({ status: 'DONE' })
  assert.equal(badStatus.ok, false)

  const badType = parsePublicInquiryAdminListQuery({ inquiryType: 'UNKNOWN' })
  assert.equal(badType.ok, false)
})

test('parsePublicInquiryAdminListQuery accepts filters and dates', () => {
  const r = parsePublicInquiryAdminListQuery({
    status: 'NEW',
    inquiryType: 'FC_PERSONAL',
    q: '홍길동',
    from: '2026-01-01',
    to: '2026-01-31',
    page: '2',
    pageSize: '50',
  })
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal(r.value.status, 'NEW')
    assert.equal(r.value.inquiryType, 'FC_PERSONAL')
    assert.equal(r.value.q, '홍길동')
    assert.equal(r.value.page, 2)
    assert.equal(r.value.pageSize, 50)
    assert.ok(r.value.from instanceof Date)
    assert.ok(r.value.to instanceof Date)
  }
})

test('parsePublicInquiryAdminPatchBody validates status and requires a field', () => {
  const empty = parsePublicInquiryAdminPatchBody({})
  assert.equal(empty.ok, false)

  const bad = parsePublicInquiryAdminPatchBody({ status: 'pending' })
  assert.equal(bad.ok, false)

  const ok = parsePublicInquiryAdminPatchBody({ status: 'CHECKING', adminMemo: '확인 중' })
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.value.status, 'CHECKING')
    assert.equal(ok.value.adminMemo, '확인 중')
  }
})

test('parsePublicInquiryAdminPatchBody softDelete and assignee clear', () => {
  const soft = parsePublicInquiryAdminPatchBody({ softDelete: true })
  assert.equal(soft.ok, true)
  if (soft.ok) {
    assert.equal(soft.value.softDelete, true)
  }

  const clear = parsePublicInquiryAdminPatchBody({ assignedAdminId: null })
  assert.equal(clear.ok, true)
  if (clear.ok) {
    assert.equal(clear.value.assignedAdminId, null)
  }
})

test('resolveInquiryResolvedAt sets on COMPLETED/SPAM and clears on reopen', () => {
  const setCompleted = resolveInquiryResolvedAt('NEW', 'COMPLETED', null)
  assert.equal(setCompleted.setResolvedAtNow, true)
  assert.equal(setCompleted.clearResolvedAt, false)

  const keepExisting = resolveInquiryResolvedAt('COMPLETED', 'SPAM', new Date('2026-01-01T00:00:00Z'))
  assert.equal(keepExisting.setResolvedAtNow, false)
  assert.equal(keepExisting.clearResolvedAt, false)
  assert.ok(keepExisting.resolvedAt)

  const reopen = resolveInquiryResolvedAt('COMPLETED', 'CHECKING', new Date('2026-01-01T00:00:00Z'))
  assert.equal(reopen.clearResolvedAt, true)
  assert.equal(reopen.resolvedAt, null)
})

test('mapPublicInquiryAdminRow maps snake_case to camelCase', () => {
  const dto = mapPublicInquiryAdminRow({
    id: '550e8400-e29b-41d4-a716-446655440000',
    inquiry_type: 'FC_PERSONAL',
    name: '홍길동',
    phone_normalized: '01022221382',
    phone_display: '010-2222-1382',
    organization_name: '테스트GA',
    email: 'a@b.com',
    preferred_contact_time: 'MORNING',
    message: '문의',
    privacy_consent: true,
    privacy_consent_at: new Date('2026-03-01T00:00:00Z'),
    status: 'NEW',
    admin_memo: null,
    assigned_admin_id: null,
    assigned_admin_name: null,
    source: 'INTRODUCTION',
    created_at: new Date('2026-03-01T01:00:00Z'),
    updated_at: new Date('2026-03-01T01:00:00Z'),
    resolved_at: null,
    deleted_at: null,
  })
  assert.equal(dto.inquiryType, 'FC_PERSONAL')
  assert.equal(dto.phoneDisplay, '010-2222-1382')
  assert.equal(dto.status, 'NEW')
  assert.equal(dto.organizationName, '테스트GA')
  assert.ok(dto.createdAt.includes('2026-03-01'))
})
