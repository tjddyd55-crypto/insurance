import { describe, expect, it } from 'vitest'
import {
  buildClaimDataWithCompanySpecificFields,
  formatMultiClaimGenerateMessage,
  toSelectedClaimCompanies,
  validateCompanySelection,
  validateCompanySpecificFields,
} from './claimCompanyValidation'

describe('validateCompanySelection', () => {
  it('requires at least one company', () => {
    expect(validateCompanySelection([])).toContain('하나 이상')
    expect(validateCompanySelection(['1'])).toBeNull()
  })
})

describe('validateCompanySpecificFields', () => {
  it('includes company name in required field error', () => {
    const message = validateCompanySpecificFields(
      [{ companyId: '1', companyName: '삼성생명', companyType: 'life' }],
      { '1': {} },
    )
    expect(message).toContain('삼성생명')
    expect(message).toContain('신분증 발급일자')
  })

  it('passes when required extra field is present', () => {
    const message = validateCompanySpecificFields(
      [{ companyId: '1', companyName: '삼성생명', companyType: 'life' }],
      { '1': { idCardIssuedDate: '2020-01-01' } },
    )
    expect(message).toBeNull()
  })
})

describe('buildClaimDataWithCompanySpecificFields', () => {
  it('embeds companySpecificFields in claimData payload', () => {
    const payload = buildClaimDataWithCompanySpecificFields(
      { claimType: 'injury', treatmentDate: '2026-03-15', claimDescription: '테스트' },
      '2',
      { '2': { accidentLocation: '자택' } },
    )
    expect(payload.claimType).toBe('injury')
    expect(payload.companySpecificFields).toEqual({ accidentLocation: '자택' })
  })
})

describe('formatMultiClaimGenerateMessage', () => {
  it('reports partial success', () => {
    const message = formatMultiClaimGenerateMessage(2, [{ companyName: 'DB손보', message: '서명 필요' }])
    expect(message).toContain('2건 생성 완료')
    expect(message).toContain('DB손보')
  })
})

describe('toSelectedClaimCompanies', () => {
  it('maps selected ids to company metadata', () => {
    const rows = toSelectedClaimCompanies(
      [{ id: 3, companyName: '현대해상', faxNumber: '', companyType: 'non_life' }],
      ['3'],
    )
    expect(rows).toEqual([{ companyId: '3', companyName: '현대해상', companyType: 'non_life' }])
  })
})
