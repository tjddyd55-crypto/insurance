import { describe, expect, it } from 'vitest'

import {
  customerExcelGenderTransformErrorMessage,
  resolveGenderForCustomerImport,
  resolveGenderForCustomerImportDetailed,
  transformRow,
} from './customerExcelUpload'
import type { CustomerExcelParsedRow } from './customerExcelUpload'

function baseRow(overrides: Partial<CustomerExcelParsedRow> = {}): CustomerExcelParsedRow {
  return {
    importKey: '',
    name: '홍길동',
    phone: '01012345678',
    ssn: '',
    birthDate: '',
    genderRaw: '',
    address: '',
    addressDetail: '',
    job: '',
    memoRaw: '',
    businessRepresentativeName: '',
    businessNumber: '',
    businessAddress: '',
    businessAddressDetail: '',
    businessMemo: '',
    carrier: '',
    smsOptOut: null,
    height: '',
    weight: '',
    isDriver: null,
    carType: '',
    medical: '',
    treatmentHistoryNote: '',
    medicationHistoryNote: '',
    accountNumber: '',
    carNumber: '',
    carModel: '',
    carYear: '',
    renewalDate: '',
    insuranceHistory: '',
    inflowSource: '',
    referrerName: '',
    ...overrides,
  }
}

describe('customer excel gender normalize', () => {
  it.each(['남', '남자', '남성', 'male', 'MALE', 'M', 'm', ' 남 '])('maps %s to male', (raw) => {
    expect(resolveGenderForCustomerImport(raw, '')).toBe('male')
  })

  it.each(['여', '여자', '여성', 'female', 'FEMALE', 'F', 'f', ' female '])('maps %s to female', (raw) => {
    expect(resolveGenderForCustomerImport(raw, '')).toBe('female')
  })

  it('infers from ssn when gender empty', () => {
    expect(resolveGenderForCustomerImport('', '9001011234567')).toBe('male')
    expect(resolveGenderForCustomerImport('', '9001012234567')).toBe('female')
  })

  it('rejects gender ssn conflict', () => {
    const res = resolveGenderForCustomerImportDetailed('여', '9001011234567')
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.code).toBe('gender_ssn_conflict')
      expect(customerExcelGenderTransformErrorMessage(res.code)).toContain('일치하지 않')
    }
    expect(transformRow(baseRow({ genderRaw: '여', ssn: '9001011234567' }))).toBeNull()
  })

  it('allows birthDate + gender without full rrn', () => {
    const payload = transformRow(
      baseRow({
        ssn: '',
        birthDate: '1990-05-05',
        genderRaw: '여',
      }),
    )
    expect(payload?.gender).toBe('female')
    expect(payload?.birthDate).toBe('1990-05-05')
    expect(payload?.ssn).toBe('')
  })
})
