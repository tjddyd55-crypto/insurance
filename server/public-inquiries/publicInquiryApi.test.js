import assert from 'node:assert/strict'
import test from 'node:test'
import { ensurePublicServiceInquiriesSchema } from './ensurePublicServiceInquiriesSchema.js'
import {
  formatPhoneDisplay,
  normalizeMessageForHash,
  normalizePhone,
  validatePublicInquiryBody,
} from './publicInquiryValidation.js'

test('normalizePhone strips non-digits', () => {
  assert.equal(normalizePhone('010-2222-1382'), '01022221382')
  assert.equal(normalizePhone('010 2222 1382'), '01022221382')
  assert.equal(normalizePhone(null), '')
})

test('formatPhoneDisplay groups KR mobile digits', () => {
  assert.equal(formatPhoneDisplay('01022221382'), '010-2222-1382')
  assert.equal(formatPhoneDisplay('0212345678'), '021-234-5678')
})

test('normalizeMessageForHash trims and collapses whitespace', () => {
  assert.equal(normalizeMessageForHash('  hello   world  '), 'hello world')
})

test('validatePublicInquiryBody accepts a valid payload', () => {
  const result = validatePublicInquiryBody({
    inquiryType: 'FC_PERSONAL',
    name: '홍길동',
    phone: '010-2222-1382',
    organizationName: '테스트GA',
    email: 'test@example.com',
    preferredContactTime: 'MORNING',
    message: '도입 문의드립니다. 연락 부탁드립니다.',
    privacyConsent: true,
    companyWebsite: '',
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.phoneNormalized, '01022221382')
    assert.equal(result.value.phoneDisplay, '010-2222-1382')
    assert.equal(result.value.inquiryType, 'FC_PERSONAL')
    assert.equal(result.value.privacyConsent, true)
  }
})

test('validatePublicInquiryBody rejects short name and missing consent', () => {
  const shortName = validatePublicInquiryBody({
    inquiryType: 'OTHER',
    name: '가',
    phone: '01022221382',
    message: '문의 내용입니다.',
    privacyConsent: true,
  })
  assert.equal(shortName.ok, false)

  const noConsent = validatePublicInquiryBody({
    inquiryType: 'OTHER',
    name: '홍길동',
    phone: '01022221382',
    message: '문의 내용입니다.',
    privacyConsent: false,
  })
  assert.equal(noConsent.ok, false)
  if (!noConsent.ok) {
    assert.equal(noConsent.code, 'VALIDATION_ERROR')
  }
})

test('validatePublicInquiryBody rejects invalid inquiryType and phone length', () => {
  const badType = validatePublicInquiryBody({
    inquiryType: 'UNKNOWN',
    name: '홍길동',
    phone: '01022221382',
    message: '문의 내용입니다.',
    privacyConsent: true,
  })
  assert.equal(badType.ok, false)

  const badPhone = validatePublicInquiryBody({
    inquiryType: 'OTHER',
    name: '홍길동',
    phone: '123',
    message: '문의 내용입니다.',
    privacyConsent: true,
  })
  assert.equal(badPhone.ok, false)
})

test('ensurePublicServiceInquiriesSchema emits CREATE / ALTER / indexes', async () => {
  const executed = []
  const executor = {
    query: async (sql) => {
      executed.push(String(sql))
      return { rows: [], rowCount: 0 }
    },
  }

  await ensurePublicServiceInquiriesSchema(executor)

  assert.ok(executed.some((sql) => /CREATE TABLE IF NOT EXISTS public_service_inquiries/i.test(sql)))
  assert.ok(executed.some((sql) => /ALTER TABLE public_service_inquiries/i.test(sql)))
  assert.ok(executed.some((sql) => /idx_psi_status_created/i.test(sql)))
  assert.ok(executed.some((sql) => /idx_psi_dedupe/i.test(sql)))
  assert.ok(executed.some((sql) => /idx_psi_new_count/i.test(sql)))
})
