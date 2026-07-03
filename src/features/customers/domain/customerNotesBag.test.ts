import { describe, expect, it } from 'vitest'
import { customerAccountNumberText, normalizeCustomerNotesBag } from './types'

describe('normalizeCustomerNotesBag - accountNumber', () => {
  it('parses accountNumber from an object bag', () => {
    const bag = normalizeCustomerNotesBag({
      items: [],
      insuranceHistory: '실손 가입',
      accountNumber: '국민 123-45-6789 홍길동',
    })
    expect(bag.accountNumber).toBe('국민 123-45-6789 홍길동')
  })

  it('defaults accountNumber to empty string when missing', () => {
    const bag = normalizeCustomerNotesBag({ items: [], insuranceHistory: '' })
    expect(bag.accountNumber).toBe('')
  })

  it('treats a legacy array bag as no accountNumber', () => {
    const bag = normalizeCustomerNotesBag([{ id: '1', content: 'memo', createdAt: 'x' }])
    expect(bag.accountNumber).toBe('')
  })

  it('ignores a non-string accountNumber value', () => {
    const bag = normalizeCustomerNotesBag({ items: [], insuranceHistory: '', accountNumber: 123 })
    expect(bag.accountNumber).toBe('')
  })

  it('customerAccountNumberText trims the stored value', () => {
    const text = customerAccountNumberText({
      notes: normalizeCustomerNotesBag({ items: [], insuranceHistory: '', accountNumber: '  1234  ' }),
    })
    expect(text).toBe('1234')
  })
})
