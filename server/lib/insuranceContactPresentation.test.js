import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createInsuranceContactVCard,
  mapInsuranceContactRow,
  normalizeInsuranceContactPhone,
} from './insuranceContactPresentation.js'

test('normalizeInsuranceContactPhone strips non-digits', () => {
  assert.equal(normalizeInsuranceContactPhone('010-1234-5678'), '01012345678')
})

test('mapInsuranceContactRow maps API fields', () => {
  const row = mapInsuranceContactRow({
    id: 7,
    category: 'LIFE',
    company_name: 'ACME',
    manager_name: 'Kim',
    position: 'Mgr',
    phone_number: '01011112222',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
  })
  assert.equal(row.id, '7')
  assert.equal(row.companyName, 'ACME')
  assert.equal(row.phoneNumber, '01011112222')
})

test('createInsuranceContactVCard includes tel line', () => {
  const vcard = createInsuranceContactVCard({
    manager_name: 'Kim',
    company_name: 'ACME',
    position: 'Mgr',
    phone_number: '01011112222',
  })
  assert.match(vcard, /BEGIN:VCARD/)
  assert.match(vcard, /TEL:01011112222/)
})
