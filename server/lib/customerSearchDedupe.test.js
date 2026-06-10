import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  dedupeCustomersById,
  dedupeCustomersForSearch,
  getCustomerSearchIdentityKey,
  normalizeCustomerId,
  normalizePhoneForCustomerDedupe,
} from './customerSearchDedupe.js'

describe('customerSearchDedupe', () => {
  it('normalizePhone strips non-digits', () => {
    assert.equal(normalizePhoneForCustomerDedupe('010-2222-1382'), '01022221382')
    assert.equal(normalizePhoneForCustomerDedupe('010 2222 1382'), '01022221382')
  })

  it('identity key requires name phone and ssn/birth prefix', () => {
    assert.equal(
      getCustomerSearchIdentityKey({ name: '박성용', phone: '01022221382', ssn: '840101-1' }),
      '01022221382:박성용:840101',
    )
    assert.equal(getCustomerSearchIdentityKey({ name: '박성용', phone: '01022221382' }), null)
  })

  it('dedupe merges same identity and keeps older createdAt when consult tied', () => {
    const { customers, meta } = dedupeCustomersForSearch([
      {
        id: 668,
        name: '박성용',
        phone: '01022221382',
        ssn: '8401011',
        createdAt: '2026-04-22T02:22:11.079Z',
      },
      {
        id: 14,
        name: '박성용',
        phone: '010-2222-1382',
        ssn: '8401012',
        createdAt: '2026-04-05T09:56:22.704Z',
      },
    ])
    assert.equal(customers.length, 1)
    assert.equal(customers[0].id, 14)
    assert.equal(meta.beforeCount, 2)
    assert.equal(meta.afterCount, 1)
  })

  it('dedupe by id when same id appears twice', () => {
    const row = { id: 519, name: '김도훈', phone: '01032968607', ssn: '7701011', createdAt: '2026-04-05T10:00:37.988Z' }
    const { customers } = dedupeCustomersForSearch([row, { ...row }])
    assert.equal(customers.length, 1)
  })

  it('normalizeCustomerId coerces number and numeric string', () => {
    assert.equal(normalizeCustomerId({ id: 28 }), '28')
    assert.equal(normalizeCustomerId({ id: '28' }), '28')
    assert.equal(normalizeCustomerId({ customerId: 8 }), '8')
    assert.equal(normalizeCustomerId({ id: 0 }), null)
    assert.equal(normalizeCustomerId({ id: 'x' }), null)
  })

  it('dedupeCustomersById merges number and string forms of the same id', () => {
    const first = { id: 28, name: '곽소현', phone: '01000000000' }
    const second = { id: '28', name: '곽소현', phone: '01000000000' }
    const out = dedupeCustomersById([first, second])
    assert.equal(out.length, 1)
    assert.equal(out[0].id, 28)
  })

  it('does not merge different phones', () => {
    const { customers } = dedupeCustomersForSearch([
      { id: 1, name: '홍길동', phone: '01011111111', ssn: '9001011', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 2, name: '홍길동', phone: '01022222222', ssn: '9001011', createdAt: '2026-01-02T00:00:00.000Z' },
    ])
    assert.equal(customers.length, 2)
  })

  it('merges kim jinwoo with different phone formatting', () => {
    const { customers } = dedupeCustomersForSearch([
      {
        id: 694,
        name: '김진우',
        phone: '010-6357-0921',
        ssn: '7501011',
        createdAt: '2026-04-28T02:08:26.938Z',
      },
      {
        id: 56,
        name: '김진우',
        phone: '01063570921',
        ssn: '7501012',
        createdAt: '2026-04-05T09:56:35.901Z',
      },
    ])
    assert.equal(customers.length, 1)
    assert.equal(customers[0].id, 56)
  })
})
