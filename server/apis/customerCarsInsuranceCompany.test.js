import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  mapCarRow,
  normalizeInsuranceCompanyOrNull,
  registerCustomerCarsApi,
} from './customerCarsApi.js'

const here = dirname(fileURLToPath(import.meta.url))
const initDbSource = readFileSync(join(here, '..', 'initDb.js'), 'utf8')

function baseRow(extra = {}) {
  return {
    id: 7,
    customer_id: 11,
    car_type: '',
    car_number: '12가3456',
    car_model: '그랜저',
    car_year: '2022',
    renewal_date: '2027-01-02',
    memo: '',
    is_primary: true,
    sort_order: 0,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...extra,
  }
}

/** routes + fake pg client that records queries */
function setup(existingRow) {
  const routes = {}
  const router = {}
  for (const m of ['get', 'post', 'patch', 'delete']) {
    router[m] = (path, _auth, handler) => {
      routes[`${m} ${path}`] = handler
    }
  }
  const calls = []
  let stored = existingRow ? { ...existingRow } : null
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params })
      if (/^\s*(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [], rowCount: 0 }
      if (/SELECT id FROM customers/.test(sql)) return { rows: [{ id: 11 }], rowCount: 1 }
      if (/COUNT\(\*\)/.test(sql)) return { rows: [{ c: 1 }], rowCount: 1 }
      if (/MAX\(sort_order\)/.test(sql)) return { rows: [{ n: 0 }], rowCount: 1 }
      if (/INSERT INTO customer_cars/.test(sql)) {
        stored = baseRow({ insurance_company: params[11] })
        return { rows: [stored], rowCount: 1 }
      }
      if (/UPDATE customer_cars\s+SET car_type/.test(sql)) {
        stored = { ...stored, insurance_company: params[11] }
        return { rows: [stored], rowCount: 1 }
      }
      if (/SELECT \* FROM customer_cars/.test(sql)) return { rows: stored ? [stored] : [], rowCount: stored ? 1 : 0 }
      if (/SELECT car_type, car_number/.test(sql)) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    },
    release() {},
  }
  const pool = { connect: async () => client, query: client.query }
  registerCustomerCarsApi(router, { pool, requireAuth: () => {}, handleDbError: (e) => { throw e } })
  return { routes, calls, getStored: () => stored }
}

function fakeRes() {
  const res = { statusCode: 200, body: undefined }
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.body = b; return res }
  res.send = () => res
  return res
}

const user = { id: 'u1', gaId: 3 }

describe('customer_cars insurance_company (보험회사 free text)', () => {
  it('initDb adds a nullable additive text column', () => {
    assert.match(initDbSource, /ALTER TABLE customer_cars\s+ADD COLUMN IF NOT EXISTS insurance_company TEXT NULL/)
  })

  it('normalizes: trims, empty → null', () => {
    assert.equal(normalizeInsuranceCompanyOrNull('  삼성화재 '), '삼성화재')
    assert.equal(normalizeInsuranceCompanyOrNull(''), null)
    assert.equal(normalizeInsuranceCompanyOrNull('   '), null)
    assert.equal(normalizeInsuranceCompanyOrNull(undefined), null)
    assert.equal(normalizeInsuranceCompanyOrNull(null), null)
  })

  it('mapCarRow exposes insuranceCompany; legacy NULL maps to empty string', () => {
    assert.equal(mapCarRow(baseRow({ insurance_company: '삼성화재' })).insuranceCompany, '삼성화재')
    assert.equal(mapCarRow(baseRow({ insurance_company: null })).insuranceCompany, '')
    assert.equal(mapCarRow(baseRow()).insuranceCompany, '')
  })

  it('POST stores the value; legacy payload without the field stores NULL', async () => {
    const a = setup(null)
    const res = fakeRes()
    await a.routes['post /customers/:customerId/cars'](
      { user, params: { customerId: '11' }, body: { carNumber: '1', carModel: 'x', carYear: '2022', renewalDate: '', insuranceCompany: '삼성화재' } },
      res,
    )
    assert.equal(res.statusCode, 201)
    assert.equal(res.body.insuranceCompany, '삼성화재')

    const b = setup(null)
    const res2 = fakeRes()
    await b.routes['post /customers/:customerId/cars'](
      { user, params: { customerId: '11' }, body: { carNumber: '1', carModel: 'x', carYear: '2022', renewalDate: '' } },
      res2,
    )
    assert.equal(res2.statusCode, 201)
    assert.equal(b.getStored().insurance_company, null)
    assert.equal(res2.body.insuranceCompany, '')
  })

  it('PATCH edits / clears; legacy payload without the field keeps the existing value', async () => {
    const s = setup(baseRow({ insurance_company: '삼성화재' }))
    const patch = s.routes['patch /customers/:customerId/cars/:carId']
    const p = { customerId: '11', carId: '7' }

    let res = fakeRes()
    await patch({ user, params: p, body: { carModel: '쏘나타' } }, res)
    assert.equal(res.body.insuranceCompany, '삼성화재')

    res = fakeRes()
    await patch({ user, params: p, body: { insuranceCompany: '현대해상' } }, res)
    assert.equal(res.body.insuranceCompany, '현대해상')

    res = fakeRes()
    await patch({ user, params: p, body: { insuranceCompany: '' } }, res)
    assert.equal(s.getStored().insurance_company, null)
    assert.equal(res.body.insuranceCompany, '')
  })
})
