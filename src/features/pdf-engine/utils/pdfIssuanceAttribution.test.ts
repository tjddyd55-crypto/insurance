import { describe, expect, it } from 'vitest'
import {
  buildPdfIssuanceSaveAttribution,
  formatVehicleSnapshotLabel,
  parsePdfCustomerSummaryFromUnknown,
  resolveIssuanceAttributionForDownload,
  resolvePdfCustomerStatusMessage,
  resolvePdfIssuanceLoadWarning,
  resolvePdfIssuanceUnassignedNotice,
  resolveIssuanceCustomerDisplayLabel,
  resolvePdfMappingCustomerId,
} from './pdfIssuanceAttribution'

describe('pdfIssuanceAttribution', () => {
  it('buildPdfIssuanceSaveAttribution: 귀속·적용 고객 모두 없으면 빈 객체', () => {
    expect(buildPdfIssuanceSaveAttribution(null, null, null, [])).toEqual({})
  })

  it('buildPdfIssuanceSaveAttribution: attributionCustomer 우선 저장', () => {
    expect(
      buildPdfIssuanceSaveAttribution(
        { id: 10, name: 'Kim' },
        { id: 99, name: 'Other' },
        null,
        [],
      ),
    ).toEqual({
      issuanceCustomerId: 10,
      customerSnapshot: { id: 10, name: 'Kim' },
    })
  })

  it('buildPdfIssuanceSaveAttribution: appliedCustomer fallback + vehicle snapshot', () => {
    expect(
      buildPdfIssuanceSaveAttribution(
        null,
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

  it('parsePdfCustomerSummaryFromUnknown: id / customerId 모두 지원', () => {
    expect(parsePdfCustomerSummaryFromUnknown({ customerId: 5, name: 'Lee' })).toEqual({
      id: 5,
      name: 'Lee',
    })
  })

  it('resolvePdfMappingCustomerId: appliedCustomer 만 mapping 대상', () => {
    expect(resolvePdfMappingCustomerId(null)).toBeUndefined()
    expect(resolvePdfMappingCustomerId({ id: 3, name: 'A' })).toBe(3)
  })

  it('resolvePdfCustomerStatusMessage', () => {
    expect(
      resolvePdfCustomerStatusMessage({ attributionCustomer: null, appliedCustomer: null }),
    ).toContain('고객 미지정')
    expect(
      resolvePdfCustomerStatusMessage({
        attributionCustomer: { id: 1, name: 'Kim' },
        appliedCustomer: null,
      }),
    ).toContain('귀속')
    expect(
      resolvePdfCustomerStatusMessage({
        attributionCustomer: { id: 1, name: 'Kim' },
        appliedCustomer: { id: 1, name: 'Kim' },
      }),
    ).toContain('반영')
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

  it('resolveIssuanceAttributionForDownload: live 우선, 없으면 preview 스냅샷', () => {
    expect(
      resolveIssuanceAttributionForDownload(
        { issuanceCustomerId: 2, customerSnapshot: { id: 2, name: 'B' } },
        { issuanceCustomerId: 1, customerSnapshot: { id: 1, name: 'A' } },
      ).issuanceCustomerId,
    ).toBe(2)
    expect(
      resolveIssuanceAttributionForDownload({}, { issuanceCustomerId: 1, customerSnapshot: { id: 1, name: 'A' } })
        .issuanceCustomerId,
    ).toBe(1)
  })

  it('formatVehicleSnapshotLabel', () => {
    expect(formatVehicleSnapshotLabel({ id: 1, carNumber: '12가3456', carModel: '소나타', carYear: '2020' })).toBe(
      '12가3456 · 소나타',
    )
  })
})
