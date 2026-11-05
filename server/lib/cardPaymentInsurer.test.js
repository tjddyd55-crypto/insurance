import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { mapContractPublicRow, parseContractWriteBody, resolveContractInsurer } from './cardPaymentService.js'

describe('contract write body insurer fields', () => {
  it('accepts insuranceCompanyId without text', () => {
    const p = parseContractWriteBody({ insuranceCompanyId: 4 })
    assert.ok(!('error' in p))
    assert.equal(p.value.insuranceCompanyId, 4)
    assert.equal(p.value.hasInsuranceCompanyId, true)
  })
  it('text-only (Native) keeps working and flags no id key', () => {
    const p = parseContractWriteBody({ insuranceCompany: 'KB손보' })
    assert.ok(!('error' in p))
    assert.equal(p.value.hasInsuranceCompanyId, false)
    assert.equal(p.value.insuranceCompanyId, null)
  })
  it('기타: null id requires text', () => {
    assert.ok('error' in parseContractWriteBody({ insuranceCompanyId: null }))
    const p = parseContractWriteBody({ insuranceCompanyId: null, insuranceCompany: '지역 공제' })
    assert.ok(!('error' in p))
    assert.equal(p.value.hasInsuranceCompanyId, true)
  })
  it('rejects invalid id', () => {
    assert.ok('error' in parseContractWriteBody({ insuranceCompanyId: 'abc', insuranceCompany: 'x' }))
    assert.ok('error' in parseContractWriteBody({ insuranceCompanyId: 0, insuranceCompany: 'x' }))
  })
})

function fakePool(rows) {
  const calls = []
  return { calls, async query(sql, params = []) { calls.push({ sql, params }); return { rows } } }
}

describe('resolveContractInsurer (no auto matching)', () => {
  it('fills insurance_company with the catalog name when id is given', async () => {
    const pool = fakePool([{ id: 1, name: '현대해상', category: 'non_life' }])
    const r = await resolveContractInsurer(pool, { insuranceCompany: '아무거나', insuranceCompanyId: 1, hasInsuranceCompanyId: true })
    assert.equal(r.insuranceCompany, '현대해상')
    assert.equal(r.insuranceCompanyId, 1)
    assert.equal(r.explicit, true)
  })
  it('errors on unknown id', async () => {
    const r = await resolveContractInsurer(fakePool([]), { insuranceCompany: '', insuranceCompanyId: 999, hasInsuranceCompanyId: true })
    assert.ok('error' in r)
  })
  it('text-only never queries the catalog and never links (even exact names)', async () => {
    const pool = fakePool([{ id: 1, name: '현대해상', category: 'non_life' }])
    const a = await resolveContractInsurer(pool, { insuranceCompany: '현대해상', insuranceCompanyId: null, hasInsuranceCompanyId: false })
    assert.equal(a.insuranceCompanyId, null)
    assert.equal(a.insuranceCompany, '현대해상')
    assert.equal(a.explicit, false)
    const b = await resolveContractInsurer(pool, { insuranceCompany: 'KB손보', insuranceCompanyId: null, hasInsuranceCompanyId: true })
    assert.equal(b.insuranceCompanyId, null)
    assert.equal(b.explicit, true)
    assert.equal(pool.calls.length, 0)
  })
})

describe('contract public row insurer fields', () => {
  it('maps insurer id/name/category and keeps original text', () => {
    const row = mapContractPublicRow(
      { id: 1, ga_id: 1, customer_id: 2, insurance_company: 'KB손보', insurance_company_id: 3, insurer_site_name: 'KB손해보험', insurer_site_category: 'non_life', status: 'PENDING' },
      '2026-11',
    )
    assert.equal(row.insuranceCompany, 'KB손보')
    assert.equal(row.insuranceCompanyId, 3)
    assert.equal(row.insurerName, 'KB손해보험')
    assert.equal(row.insurerCategory, 'NON_LIFE')
    const legacy = mapContractPublicRow({ id: 2, ga_id: 1, customer_id: 2, insurance_company: '현대해상', status: 'PENDING' }, '2026-11')
    assert.equal(legacy.insuranceCompanyId, null)
    assert.equal(legacy.insurerCategory, null)
  })
})

describe('schema + query wiring', () => {
  const svc = readFileSync(new URL('./cardPaymentService.js', import.meta.url), 'utf8')
  const init = readFileSync(new URL('../initDb.js', import.meta.url), 'utf8')
  it('adds additive nullable FK to insurer_sites with index', () => {
    assert.match(init, /ADD COLUMN IF NOT EXISTS insurance_company_id INTEGER NULL\s+REFERENCES insurer_sites\(id\) ON DELETE SET NULL/)
    assert.match(init, /idx_customer_card_payment_contracts_insurer_site/)
  })
  it('no alias/backfill auto-matching logic', () => {
    assert.doesNotMatch(svc, /alias|backfill/i)
  })
  it('overview joins insurer_sites once and supports insuranceCompanyId filter', () => {
    assert.match(svc, /LEFT JOIN insurer_sites isite ON isite\.id = ctr\.insurance_company_id/)
    assert.match(svc, /insuranceCompanyIdFilter === 'unassigned'/)
  })
  it('Native text-only update keeps link only when text unchanged', () => {
    assert.match(svc, /WHEN insurance_company = \$2 THEN insurance_company_id/)
  })
})
