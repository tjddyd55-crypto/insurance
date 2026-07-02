import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateInsuranceAgeFromBirthDate,
  getSangnyeongDday,
  normalizeCustomerGender,
  resolveCustomerInsuranceMetrics,
} from '../../shared/customerInsuranceMetrics.js'
import { matchesSearch, mergeRecipientSelections, searchSmsRecipientCustomers } from './smsRecipientSearchService.js'

const sampleRows = [
  {
    id: 1,
    name: '박성용',
    phone: '01022221382',
    gender: 'male',
    ssn: '8402181',
    insurance_age: 42,
    next_age_date: null,
    birth_date: new Date(1984, 1, 18),
  },
  {
    id: 2,
    name: '김민수',
    phone: '01033334444',
    gender: 'male',
    ssn: '9001011',
    insurance_age: 36,
    next_age_date: null,
    birth_date: new Date(1990, 0, 1),
  },
  {
    id: 3,
    name: '박성용',
    phone: null,
    gender: 'female',
    ssn: null,
    insurance_age: null,
    next_age_date: null,
    birth_date: null,
  },
  {
    id: 4,
    name: '테스트',
    phone: '01099998888',
    gender: 'female',
    ssn: null,
    insurance_age: null,
    next_age_date: null,
    birth_date: null,
  },
]

function createMockExecutor(rows) {
  return {
    query: async (sql) => {
      const text = String(sql)
      if (text.includes('sms_opt_outs')) {
        return { rows: [] }
      }
      if (text.includes('FROM customers')) {
        return { rows }
      }
      return { rows: [] }
    },
  }
}

test('matchesSearch does not match every phone when query has no digits', () => {
  assert.equal(matchesSearch(sampleRows[0], '박성용'), true)
  assert.equal(matchesSearch(sampleRows[1], '박성용'), false)
  assert.equal(matchesSearch(sampleRows[2], '박성용'), true)
})

test('matchesSearch matches phone and birth date fragments', () => {
  assert.equal(matchesSearch(sampleRows[0], '0102222'), true)
  assert.equal(matchesSearch(sampleRows[1], '0102222'), false)
  assert.equal(matchesSearch(sampleRows[0], '1984'), true)
})

test('searchSmsRecipientCustomers applies search and excludes blocked by default', async () => {
  const result = await searchSmsRecipientCustomers(
    createMockExecutor(sampleRows),
    { tenantId: 1, userId: 'user-1' },
    { search: '박성용' },
  )
  assert.equal(result.totalCount, 1)
  assert.equal(result.customers.length, 1)
  assert.equal(result.customers[0].name, '박성용')
  assert.equal(result.customers[0].canSend, true)
})

test('searchSmsRecipientCustomers excludes no_phone even when name matches', async () => {
  const result = await searchSmsRecipientCustomers(
    createMockExecutor(sampleRows),
    { tenantId: 1, userId: 'user-1' },
    { search: '박성용', includeBlocked: false },
  )
  assert.ok(result.customers.every((row) => row.canSend))
  assert.ok(result.customers.every((row) => row.blockedReason == null))
})

test('searchSmsRecipientCustomers can include blocked when includeBlocked=true', async () => {
  const result = await searchSmsRecipientCustomers(
    createMockExecutor(sampleRows),
    { tenantId: 1, userId: 'user-1' },
    { search: '박성용', includeBlocked: true },
  )
  assert.equal(result.totalCount, 2)
  assert.ok(result.customers.some((row) => row.blockedReason === 'no_phone'))
})

test('searchSmsRecipientCustomers dedupes same identity across multiple customer ids', async () => {
  const duplicateIdentityRows = [6, 7, 8, 9, 10, 14].map((id, index) => ({
    id,
    name: '박성용',
    phone: '01022221382',
    gender: 'male',
    ssn: '8402181',
    insurance_age: 42,
    next_age_date: null,
    birth_date: new Date(1984, 1, 18),
    created_at: `2026-01-0${index + 1}T00:00:00.000Z`,
  }))

  const result = await searchSmsRecipientCustomers(
    createMockExecutor(duplicateIdentityRows),
    { tenantId: 1, userId: 'user-1' },
    { search: '박성용' },
  )

  assert.equal(result.totalCount, 1)
  assert.equal(result.customers.length, 1)
  assert.equal(result.customers[0].customerId, 6)
  assert.equal(new Set(result.customers.map((row) => row.customerId)).size, 1)
})

test('searchSmsRecipientCustomers keeps different customer_id with same phone', async () => {
  const result = await searchSmsRecipientCustomers(
    createMockExecutor([
      {
        id: 101,
        name: '홍길동',
        phone: '01022221382',
        gender: 'male',
        ssn: '9001011',
        insurance_age: 30,
        next_age_date: null,
        birth_date: new Date(1990, 0, 1),
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 102,
        name: '김철수',
        phone: '01022221382',
        gender: 'male',
        ssn: '9101011',
        insurance_age: 29,
        next_age_date: null,
        birth_date: new Date(1991, 0, 1),
        created_at: '2026-01-02T00:00:00.000Z',
      },
    ]),
    { tenantId: 1, userId: 'user-1' },
    { search: '0102222' },
  )
  assert.equal(result.totalCount, 2)
  assert.equal(new Set(result.customers.map((row) => row.customerId)).size, 2)
})

test('searchSmsRecipientCustomers combines search with gender filter', async () => {
  const result = await searchSmsRecipientCustomers(
    createMockExecutor(sampleRows),
    { tenantId: 1, userId: 'user-1' },
    { search: '테스트', gender: 'female' },
  )
  assert.equal(result.totalCount, 1)
  assert.equal(result.customers[0].name, '테스트')
})

test('insurance age matches birth date + 6 month maturity rule', () => {
  const birth = new Date(1963, 2, 10)
  const today = new Date(2026, 6, 1)
  const result = calculateInsuranceAgeFromBirthDate(birth, today)
  assert.equal(typeof result.insuranceAge, 'number')
  assert.ok(result.insuranceAge >= 60)
})

test('sangnyeong dday excludes past dates for filter semantics', () => {
  const today = new Date(2026, 6, 1)
  const future = new Date(today)
  future.setDate(future.getDate() + 18)
  const ymd = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`
  const dday = getSangnyeongDday(ymd, today)
  assert.equal(dday, 18)
})

test('gender normalization accepts Korean and English values', () => {
  assert.equal(normalizeCustomerGender('남'), 'male')
  assert.equal(normalizeCustomerGender('female'), 'female')
  assert.equal(normalizeCustomerGender(''), null)
})

test('mergeRecipientSelections dedupes customer and phone', () => {
  const existing = [
    {
      customerId: 1,
      name: 'A',
      gender: 'male',
      genderLabel: '남자',
      birthDate: '1960-01-01',
      phone: '01011112222',
      phoneDisplay: '010-1111-2222',
      insuranceAge: 60,
      sangnyeongDday: 10,
      sangnyeongLabel: '상령일 D-10',
      canSend: true,
      blockedReason: null,
    },
  ]
  const incoming = [
    { ...existing[0], customerId: 1 },
    {
      ...existing[0],
      customerId: 2,
      name: 'B',
      phone: '01011112222',
    },
    {
      ...existing[0],
      customerId: 3,
      name: 'C',
      phone: '01033334444',
      canSend: false,
      blockedReason: 'opt_out',
    },
  ]
  const merged = mergeRecipientSelections(existing, incoming)
  assert.equal(merged.recipients.length, 2)
  assert.equal(merged.addedCount, 1)
  assert.equal(merged.skipped.already_added, 1)
  assert.equal(merged.skipped.duplicate_phone, 1)
})

test('resolveCustomerInsuranceMetrics uses rrn when available', () => {
  const metrics = resolveCustomerInsuranceMetrics({
    ssn: '6303101',
    gender: 'male',
    insurance_age: null,
    next_age_date: null,
    birth_date: null,
  })
  assert.ok(metrics.insuranceAge != null)
  assert.ok(metrics.maturityYmd)
})
