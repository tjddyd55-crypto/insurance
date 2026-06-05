import { describe, expect, it } from 'vitest'
import {
  buildPdfIssuanceSaveAttribution,
  resolvePdfIssuanceLoadWarning,
  resolvePdfIssuanceUnassignedNotice,
  resolveIssuanceCustomerDisplayLabel,
  resolvePdfMappingCustomerId,
} from './pdfIssuanceAttribution'

describe('pdfIssuanceAttribution', () => {
  it('buildPdfIssuanceSaveAttribution: appliedCustomer 없으면 빈 객체', () => {
    expect(buildPdfIssuanceSaveAttribution(null, null, [])).toEqual({})
  })

  it('buildPdfIssuanceSaveAttribution: appliedCustomer·차량 적용 시 snapshot 저장', () => {
    expect(
      buildPdfIssuanceSaveAttribution(
        { id: 10, name: '홍길동', phone: '010-1111-2222' },
        7,
        [
          {
            id: 7,
            customerId: 10,
            carType: '승용',
            carNumber: '12가3456',
            carModel: '소나타',
            carYear: '2020',
            renewalDate: null,
            memo: '',
            isPrimary: true,
            sortOrder: 0,
            createdAt: '',
            updatedAt: '',
          },
        ],
      ),
    ).toEqual({
      issuanceCustomerId: 10,
      customerSnapshot: { id: 10, name: '홍길동', phone: '010-1111-2222' },
      vehicleSnapshot: {
        id: 7,
        carNumber: '12가3456',
        carModel: '소나타',
        carYear: '2020',
        carType: '승용',
        renewalDate: null,
      },
    })
  })

  it('resolvePdfMappingCustomerId: appliedCustomer 만 mapping 대상', () => {
    expect(resolvePdfMappingCustomerId(null)).toBeUndefined()
    expect(resolvePdfMappingCustomerId({ id: 3, name: 'A' })).toBe(3)
  })

  it('resolvePdfIssuanceLoadWarning: 귀속 고객과 작업 고객이 다를 때만 경고', () => {
    expect(
      resolvePdfIssuanceLoadWarning({
        issuanceCustomerId: 1,
        issuanceCustomerLabel: 'Kim',
        contextCustomerId: 2,
      }),
    ).toContain('Kim')
    expect(
      resolvePdfIssuanceLoadWarning({
        issuanceCustomerId: 1,
        issuanceCustomerLabel: 'Kim',
        contextCustomerId: 1,
      }),
    ).toBeNull()
    expect(
      resolvePdfIssuanceLoadWarning({
        issuanceCustomerId: null,
        issuanceCustomerLabel: null,
        contextCustomerId: 2,
      }),
    ).toBeNull()
  })

  it('resolvePdfIssuanceUnassignedNotice: customer_id null 일 때만', () => {
    expect(resolvePdfIssuanceUnassignedNotice(null)).toContain('고객 미지정')
    expect(resolvePdfIssuanceUnassignedNotice(1)).toBeNull()
  })

  it('resolveIssuanceCustomerDisplayLabel', () => {
    expect(
      resolveIssuanceCustomerDisplayLabel({ customerId: null, customerLabel: null }),
    ).toBe('고객 미지정')
    expect(
      resolveIssuanceCustomerDisplayLabel({ customerId: 5, customerLabel: 'Lee' }),
    ).toBe('Lee')
  })
})
