import { describe, expect, it } from 'vitest'
import type { CardPaymentContractRow } from '../api/premiumPaymentsApi'
import { buildInsurerGroupOptions, filterInsurerOptions, groupContractsByCustomerForInsurer, insurerGroupKeyOf } from './insurerGrouping'

function row(p: Partial<CardPaymentContractRow>): CardPaymentContractRow {
  return { id: 0, customerId: 0, insuranceCompany: '', insuranceCompanyId: null, insurerName: null, insurerCategory: null, ...p } as CardPaymentContractRow
}

const rows = [
  row({ id: 1, customerId: 10, customerName: '홍길동', insuranceCompany: '삼성화재', insuranceCompanyId: 2, insurerName: '삼성화재', insurerCategory: 'NON_LIFE' }),
  row({ id: 2, customerId: 10, customerName: '홍길동', insuranceCompany: '삼성화재', insuranceCompanyId: 2, insurerName: '삼성화재', insurerCategory: 'NON_LIFE' }),
  row({ id: 3, customerId: 10, customerName: '홍길동', insuranceCompany: '현대해상', insuranceCompanyId: 1, insurerName: '현대해상', insurerCategory: 'NON_LIFE' }),
  row({ id: 4, customerId: 11, customerName: '가나다', insuranceCompany: '삼성화재', insuranceCompanyId: 2, insurerName: '삼성화재', insurerCategory: 'NON_LIFE' }),
  row({ id: 5, customerId: 12, customerName: '라마바', insuranceCompany: 'KB손보' }),
  row({ id: 6, customerId: 13, customerName: '생명고객', insuranceCompany: '가생명', insuranceCompanyId: 9, insurerName: '가생명', insurerCategory: 'LIFE' }),
]

describe('insurerGrouping', () => {
  it('legacy text rows without id go to 기타, empty to 미지정', () => {
    expect(insurerGroupKeyOf(rows[4])).toBe('other')
    expect(insurerGroupKeyOf(row({ insuranceCompany: '' }))).toBe('unassigned')
    expect(insurerGroupKeyOf(rows[0])).toBe('site:2')
  })
  it('options: non-life first then life, then 기타', () => {
    expect(buildInsurerGroupOptions(rows).map((o) => `${o.label}:${o.count}`)).toEqual(['삼성화재:3', '현대해상:1', '가생명:1', '기타:1'])
  })
  it('nests contracts under customers once, 가나다 order', () => {
    const g = groupContractsByCustomerForInsurer(rows, 'site:2')
    expect(g.map((c) => c.customerName)).toEqual(['가나다', '홍길동'])
    expect(g[1].contracts.map((c) => c.id)).toEqual([1, 2])
    expect(groupContractsByCustomerForInsurer(rows, 'site:1').map((c) => c.customerName)).toEqual(['홍길동'])
  })
  it('search filters within selected insurer only', () => {
    expect(groupContractsByCustomerForInsurer(rows, 'site:2', '홍').map((c) => c.customerId)).toEqual([10])
    expect(groupContractsByCustomerForInsurer(rows, 'site:2', '라마바')).toEqual([])
  })
  it('insurer search filters insurer labels only (not customers)', () => {
    const opts = buildInsurerGroupOptions([...rows, row({ id: 7, customerId: 14, customerName: '무보험' })])
    expect(opts.map((o) => o.label)).toEqual(['삼성화재', '현대해상', '가생명', '기타', '미지정'])
    expect(filterInsurerOptions(opts, '삼성').map((o) => o.label)).toEqual(['삼성화재'])
    expect(filterInsurerOptions(opts, '홍길동')).toEqual([])
    expect(filterInsurerOptions(opts, ' ').length).toBe(5)
  })
})
