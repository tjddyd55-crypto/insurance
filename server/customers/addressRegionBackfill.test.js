import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { summarizeAddressRegionBackfill } from './addressRegionBackfill.js'

describe('summarizeAddressRegionBackfill', () => {
  it('원문은 갱신 목록에 넣지 않고 실패는 null 로 남긴다', () => {
    const summary = summarizeAddressRegionBackfill([
      { id: 1, address: '서울특별시 강남구 역삼동 1', address_sido: null },
      { id: 2, address: '알 수 없는 주소', address_sido: null },
      { id: 3, address: '부산광역시 해운대구 우동', address_sido: '부산광역시' },
      { id: 4, address: '   ', address_sido: null },
    ])
    assert.equal(summary.parsed, 1)
    assert.equal(summary.failed, 1)
    assert.equal(summary.skipped, 2)
    assert.equal(summary.updates.length, 1)
    assert.equal(summary.updates[0].id, 1)
    assert.equal(summary.updates[0].addressSido, '서울특별시')
    assert.equal('address' in summary.updates[0], false)
  })

  it('같은 입력을 두 번 요약해도 건수가 같다', () => {
    const rows = [{ id: 9, address: '세종특별자치시 한솔동 1' }]
    const first = summarizeAddressRegionBackfill(rows)
    const second = summarizeAddressRegionBackfill(rows)
    assert.deepEqual(first, second)
    assert.equal(first.updates[0].addressSigungu, null)
    assert.equal(first.updates[0].addressEupmyeondong, '한솔동')
  })
})
