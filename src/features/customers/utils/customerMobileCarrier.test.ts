import { describe, expect, it } from 'vitest'
import {
  formatCustomerMobileCarrierDisplay,
  normalizeCustomerCarrierForForm,
  normalizeCustomerCarrierForSave,
} from '../config/customerMobileCarrier.config'

describe('customerMobileCarrier', () => {
  it('formatCustomerMobileCarrierDisplay: enum 코드 → 표시 라벨', () => {
    expect(formatCustomerMobileCarrierDisplay('SKT')).toBe('SKT')
    expect(formatCustomerMobileCarrierDisplay('LG_U_PLUS')).toBe('LG U+')
    expect(formatCustomerMobileCarrierDisplay('SKT_MVNO')).toBe('SKT 알뜰폰')
  })

  it('formatCustomerMobileCarrierDisplay: 빈 값 → 빈 문자열', () => {
    expect(formatCustomerMobileCarrierDisplay('')).toBe('')
    expect(formatCustomerMobileCarrierDisplay(null)).toBe('')
  })

  it('normalizeCustomerCarrierForForm: 레거시 표시 라벨 → enum', () => {
    expect(normalizeCustomerCarrierForForm('LG U+')).toBe('LG_U_PLUS')
    expect(normalizeCustomerCarrierForForm('SKT 알뜰폰')).toBe('SKT_MVNO')
  })

  it('normalizeCustomerCarrierForForm: notes 없는 기존 고객(빈 carrier) → 빈 문자열', () => {
    expect(normalizeCustomerCarrierForForm(undefined)).toBe('')
    expect(normalizeCustomerCarrierForForm('   ')).toBe('')
  })

  it('normalizeCustomerCarrierForSave: select enum 유지', () => {
    expect(normalizeCustomerCarrierForSave('KT_MVNO')).toBe('KT_MVNO')
  })

  it('normalizeCustomerCarrierForSave: 알 수 없는 레거시 자유입력은 trim 유지', () => {
    expect(normalizeCustomerCarrierForSave('  기타통신  ')).toBe('기타통신')
  })
})
