import { describe, expect, it } from 'vitest'
import {
  getCustomerBusinessQuickCrudValidationError,
  getCustomerCarQuickCrudValidationError,
  getCustomerFireInsuranceQuickCrudValidationError,
  getCustomerSpecialDateQuickCrudValidationError,
} from './customerQuickCrudValidation'

describe('customerQuickCrudValidation', () => {
  it('requires car fields for quick save', () => {
    expect(
      getCustomerCarQuickCrudValidationError({
        carNumber: '',
        carModel: '',
        carYear: '',
        renewalDate: '',
        isPrimary: false,
      }),
    ).toBe('차량 정보를 입력해 주세요.')
    expect(
      getCustomerCarQuickCrudValidationError({
        carNumber: '12가3456',
        carModel: '',
        carYear: '',
        renewalDate: '',
        isPrimary: false,
      }),
    ).toBeNull()
  })

  it('requires fire insurance address', () => {
    expect(getCustomerFireInsuranceQuickCrudValidationError({ address: '', memo: '' })).toBe(
      '주소를 검색해 주세요.',
    )
    expect(
      getCustomerFireInsuranceQuickCrudValidationError({
        address: '(06234) 서울 강남구',
        memo: '',
      }),
    ).toBeNull()
  })

  it('requires business info payload', () => {
    expect(
      getCustomerBusinessQuickCrudValidationError({
        representativeName: '',
        businessNumber: '',
        businessAddress: '',
        memo: '',
      }),
    ).toBe('사업자 정보를 입력해 주세요.')
  })

  it('requires special date label and date', () => {
    expect(
      getCustomerSpecialDateQuickCrudValidationError({
        purposeType: 'CELEBRATION',
        title: '',
        dateValue: '2026-01-01',
        memo: '',
      }),
    ).toContain('지정일')
    expect(
      getCustomerSpecialDateQuickCrudValidationError({
        purposeType: 'CELEBRATION',
        title: '결혼기념일',
        dateValue: '2026-01-01',
        memo: '',
      }),
    ).toBeNull()
  })
})
