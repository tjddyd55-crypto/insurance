import { describe, expect, it } from 'vitest'

import type { CustomerEditFormState } from '../types/customerEditForm'
import { createEmptyCustomerFireInsuranceLocation } from './customerFireInsuranceLocationFormUtils'
import {
  cloneCustomerEditFormState,
  isCustomerEditFormDirty,
  normalizeCustomerEditFormForDirtyCompare,
} from './customerEditFormDirty'
import { emptyCustomerBusinessInfoForm } from '../domain/customerBusinessInfo'

function emptyEditForm(overrides: Partial<CustomerEditFormState> = {}): CustomerEditFormState {
  return {
    name: '',
    gender: null,
    ssn: '',
    phone: '',
    carrier: '',
    birthDate: '',
    address: '',
    addressDetail: '',
    zonecode: '',
    height: '',
    weight: '',
    job: '',
    isDriver: null,
    carType: '',
    treatmentHistoryNote: '',
    medicationHistoryNote: '',
    insuranceHistory: '',
    accountNumber: '',
    cars: [],
    businessInfo: emptyCustomerBusinessInfoForm(),
    fireInsuranceLocations: [createEmptyCustomerFireInsuranceLocation()],
    specialDates: [],
    crmExtensionFields: {},
    inflowSource: '',
    referrerName: '',
    smsOptOut: false,
    ...overrides,
  }
}

describe('customerEditFormDirty', () => {
  it('hydration 직후 dirty 는 false', () => {
    const baseline = emptyEditForm({ name: '홍길동', phone: '010-1234-5678' })
    expect(isCustomerEditFormDirty(baseline, cloneCustomerEditFormState(baseline))).toBe(false)
  })

  it('필드 변경 후 dirty 는 true', () => {
    const baseline = emptyEditForm({ name: '홍길동' })
    const current = { ...cloneCustomerEditFormState(baseline), name: '홍길동2' }
    expect(isCustomerEditFormDirty(baseline, current)).toBe(true)
  })

  it('원복 후 dirty 는 false', () => {
    const baseline = emptyEditForm({ name: '홍길동' })
    const changed = { ...cloneCustomerEditFormState(baseline), name: '홍길동2' }
    expect(isCustomerEditFormDirty(baseline, changed)).toBe(true)
    expect(isCustomerEditFormDirty(baseline, baseline)).toBe(false)
  })

  it('전화번호 포맷만 달라도 dirty 는 false', () => {
    const baseline = emptyEditForm({ phone: '01012345678' })
    const current = { ...cloneCustomerEditFormState(baseline), phone: '010-1234-5678' }
    expect(isCustomerEditFormDirty(baseline, current)).toBe(false)
  })

  it('화재 소재지 메모 변경은 dirty', () => {
    const baseline = emptyEditForm({
      fireInsuranceLocations: [{ id: 1, address: '서울', memo: '원본' }],
    })
    const current = {
      ...cloneCustomerEditFormState(baseline),
      fireInsuranceLocations: [{ id: 1, address: '서울', memo: '수정' }],
    }
    expect(isCustomerEditFormDirty(baseline, current)).toBe(true)
  })

  it('normalize 는 빈 화재 row 를 동일하게 처리한다', () => {
    const withEmpty = normalizeCustomerEditFormForDirtyCompare(
      emptyEditForm({ fireInsuranceLocations: [createEmptyCustomerFireInsuranceLocation()] }),
    )
    const withoutRows = normalizeCustomerEditFormForDirtyCompare(
      emptyEditForm({ fireInsuranceLocations: [] }),
    )
    expect(withEmpty.fireInsuranceLocations).toEqual(withoutRows.fireInsuranceLocations)
  })
})
