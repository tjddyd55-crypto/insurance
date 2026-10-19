import test from 'node:test'
import assert from 'node:assert/strict'
import { patchAdvisorProfileForOwner } from './publicAdvisorProfileService.js'

const USER_ID = 'user-office-1'
const EXISTING = {
  user_id: USER_ID,
  public_slug: 'office-test',
  office_road_address: '서울 중구 세종대로 110',
  office_address_detail: '3층',
  office_postal_code: '04524',
  office_address_sido: '서울',
  office_address_sigungu: '중구',
}
const OFFICE_KEYS = [
  'office_road_address',
  'office_address_detail',
  'office_postal_code',
  'office_address_sido',
  'office_address_sigungu',
]

/** DB 없이 UPDATE 문과 바인드 값을 잡는 mock pool. */
function createMockPool() {
  const calls = []
  return {
    calls,
    async query(text, values) {
      const sql = String(text)
      calls.push({ sql, values })
      if (/FROM users u/.test(sql)) {
        return { rowCount: 1, rows: [{ id: USER_ID, username: 'office', display_name: '홍길동', is_deleted: false }] }
      }
      if (/^\s*UPDATE advisor_public_profiles/.test(sql)) {
        const row = { ...EXISTING }
        const setPart = sql.slice(sql.indexOf('SET') + 3, sql.indexOf('WHERE'))
        for (const m of setPart.matchAll(/(\w+) = \$(\d+)/g)) row[m[1]] = values[Number(m[2]) - 1]
        return { rowCount: 1, rows: [row] }
      }
      if (/SELECT \* FROM advisor_public_profiles/.test(sql)) {
        return { rowCount: 1, rows: [{ ...EXISTING }] }
      }
      return { rowCount: 0, rows: [] }
    },
  }
}

function updateCall(pool) {
  return pool.calls.find((c) => /^\s*UPDATE advisor_public_profiles/.test(c.sql))
}

function assignedColumns(call) {
  const setPart = call.sql.slice(call.sql.indexOf('SET') + 3, call.sql.indexOf('WHERE'))
  const out = {}
  for (const m of setPart.matchAll(/(\w+) = \$(\d+)/g)) out[m[1]] = call.values[Number(m[2]) - 1]
  return out
}

test('CASE1 office_road_address null is saved as empty string', async () => {
  const pool = createMockPool()
  const r = await patchAdvisorProfileForOwner(pool, USER_ID, { office_road_address: null })
  assert.equal(r.ok, true)
  const cols = assignedColumns(updateCall(pool))
  assert.equal(cols.office_road_address, '')
  assert.equal(r.profile.office_road_address, '')
})

test('CASE2 office_address_detail null is saved as empty string', async () => {
  const pool = createMockPool()
  const r = await patchAdvisorProfileForOwner(pool, USER_ID, { office_address_detail: null })
  assert.equal(r.ok, true)
  assert.equal(assignedColumns(updateCall(pool)).office_address_detail, '')
})

test('CASE3 postal / sido / sigungu null are saved as empty strings', async () => {
  const pool = createMockPool()
  const r = await patchAdvisorProfileForOwner(pool, USER_ID, {
    office_postal_code: null,
    office_address_sido: null,
    office_address_sigungu: null,
  })
  assert.equal(r.ok, true)
  const cols = assignedColumns(updateCall(pool))
  assert.equal(cols.office_postal_code, '')
  assert.equal(cols.office_address_sido, '')
  assert.equal(cols.office_address_sigungu, '')
})

test('CASE4 absent or undefined office keys keep the existing values', async () => {
  const pool = createMockPool()
  const r = await patchAdvisorProfileForOwner(pool, USER_ID, {
    headline: '새 한 줄',
    office_address_detail: undefined,
  })
  assert.equal(r.ok, true)
  const cols = assignedColumns(updateCall(pool))
  for (const key of OFFICE_KEYS) assert.equal(Object.prototype.hasOwnProperty.call(cols, key), false, key)
  assert.equal(r.profile.office_road_address, EXISTING.office_road_address)
  assert.equal(r.profile.office_address_detail, EXISTING.office_address_detail)
  assert.equal(r.profile.office_postal_code, EXISTING.office_postal_code)
})

test('CASE5 normal office strings are saved as before', async () => {
  const pool = createMockPool()
  const r = await patchAdvisorProfileForOwner(pool, USER_ID, {
    office_road_address: '서울 종로구 세종대로 175',
    office_address_detail: '12층',
    office_postal_code: '03154',
    office_address_sido: '서울',
    office_address_sigungu: '종로구',
  })
  assert.equal(r.ok, true)
  const cols = assignedColumns(updateCall(pool))
  assert.equal(cols.office_road_address, '서울 종로구 세종대로 175')
  assert.equal(cols.office_address_detail, '12층')
  assert.equal(cols.office_postal_code, '03154')
  assert.equal(cols.office_address_sido, '서울')
  assert.equal(cols.office_address_sigungu, '종로구')
})

test('CASE6 all office fields null succeed and save empty strings', async () => {
  const pool = createMockPool()
  const patch = Object.fromEntries(OFFICE_KEYS.map((k) => [k, null]))
  const r = await patchAdvisorProfileForOwner(pool, USER_ID, patch)
  assert.equal(r.ok, true)
  const cols = assignedColumns(updateCall(pool))
  for (const key of OFFICE_KEYS) {
    assert.equal(cols[key], '', key)
    assert.notEqual(cols[key], null, key)
  }
})

test('non-office text field null keeps the existing null semantics', async () => {
  const pool = createMockPool()
  await patchAdvisorProfileForOwner(pool, USER_ID, { title_label: null })
  assert.equal(assignedColumns(updateCall(pool)).title_label, null)
})
