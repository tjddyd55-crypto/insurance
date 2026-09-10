import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mapFireInsuranceLocationRow } from './customerFireInsuranceLocationsApi.js'
import { mapBusinessInfoFromRow } from '../lib/customerBusinessInfo.js'

describe('customer fire insurance / business API mapping', () => {
  it('maps fire insurance location row with sort order', () => {
    const mapped = mapFireInsuranceLocationRow({
      id: 3,
      customer_id: 10,
      address: '서울시 강남구',
      memo: '1층',
      sort_order: 1,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
    })
    assert.equal(mapped.id, 3)
    assert.equal(mapped.customerId, 10)
    assert.equal(mapped.address, '서울시 강남구')
    assert.equal(mapped.memo, '1층')
    assert.equal(mapped.sortOrder, 1)
  })

  it('returns null businessInfo for legacy customer rows', () => {
    assert.equal(
      mapBusinessInfoFromRow({
        business_representative_name: '',
        business_number: '',
        business_address: '',
        business_memo: '',
      }),
      null,
    )
  })

  it('preserves businessInfo when any field is set', () => {
    const info = mapBusinessInfoFromRow({
      business_representative_name: '홍길동',
      business_number: '123-45-67890',
      business_address: '',
      business_memo: '',
    })
    assert.equal(info.representativeName, '홍길동')
    assert.equal(info.businessNumber, '123-45-67890')
  })
})
