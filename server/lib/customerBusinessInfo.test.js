import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isBusinessInfoEmpty,
  mapBusinessInfoFromRow,
  normalizeBusinessInfoForDb,
  normalizeBusinessNumberForDb,
} from './customerBusinessInfo.js'

describe('customerBusinessInfo', () => {
  it('normalizes business number allowing digits and hyphens', () => {
    assert.equal(normalizeBusinessNumberForDb('123-45-67890'), '123-45-67890')
    assert.equal(normalizeBusinessNumberForDb('123abc45'), '12345')
  })

  it('maps row to businessInfo or null when empty', () => {
    assert.equal(
      mapBusinessInfoFromRow({
        business_representative_name: '',
        business_number: '',
        business_address: '',
        business_memo: '',
      }),
      null,
    )
    const info = mapBusinessInfoFromRow({
      business_representative_name: '홍길동',
      business_number: '123-45-67890',
      business_address: '서울',
      business_memo: '메모',
    })
    assert.deepEqual(info, {
      representativeName: '홍길동',
      businessNumber: '123-45-67890',
      businessAddress: '서울',
      memo: '메모',
    })
  })

  it('normalizes API payload object', () => {
    const info = normalizeBusinessInfoForDb({
      representativeName: '김대표',
      businessNumber: '111-22-33333',
      businessAddress: '부산',
      memo: '',
    })
    assert.equal(info.representativeName, '김대표')
    assert.equal(isBusinessInfoEmpty(info), false)
  })
})
