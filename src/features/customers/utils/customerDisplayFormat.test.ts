import { describe, expect, it } from 'vitest'

import {
  CUSTOMER_ACCOUNT_NUMBER_PLACEHOLDER,
  CUSTOMER_ACCOUNT_NUMBER_PLACEHOLDER_PUBLIC,
  CUSTOMER_MEDICAL_QUESTION_TEXT,
} from './customerDisplayFormat'
import {
  createEmptyCustomerForm,
  getCustomerFormValidationError,
} from '../../../components/customer/CustomerForm'

describe('customerDisplayFormat public registration', () => {
  it('keeps CRM account placeholder long and public placeholder short', () => {
    expect(CUSTOMER_ACCOUNT_NUMBER_PLACEHOLDER).toContain('계좌번호 입력')
    expect(CUSTOMER_ACCOUNT_NUMBER_PLACEHOLDER_PUBLIC).toBe('은행명 / 계좌번호')
    expect(CUSTOMER_ACCOUNT_NUMBER_PLACEHOLDER_PUBLIC.length).toBeLessThan(
      CUSTOMER_ACCOUNT_NUMBER_PLACEHOLDER.length,
    )
  })

  it('keeps medical question text unchanged', () => {
    expect(CUSTOMER_MEDICAL_QUESTION_TEXT).toContain('5년안에 병원')
  })
})

describe('getCustomerFormValidationError public registration', () => {
  it('skips special dates validation when requested', () => {
    const form = createEmptyCustomerForm()
    form.name = '홍길동'
    form.specialDates = [
      {
        purposeType: 'CELEBRATION',
        title: '',
        dateValue: '2024-01-01',
        memo: '',
      },
    ]
    expect(getCustomerFormValidationError(form)).not.toBeNull()
    expect(
      getCustomerFormValidationError(form, { skipSpecialDatesValidation: true }),
    ).toBeNull()
  })
})
