import { describe, expect, it } from 'vitest'
import { resolveDefaultClaimFaxNumber, validateCompanySelection } from './claimCompanyValidation'
import { claimDataKeyFromFieldKey, filterTemplateFormFields, filterTemplateFieldsForEntry } from './claimTemplateFormFields'

describe('validateCompanySelection', () => {
  it('requires one company', () => {
    expect(validateCompanySelection(null)).toContain('선택')
    expect(validateCompanySelection('')).toContain('선택')
    expect(validateCompanySelection('1')).toBeNull()
  })
})

describe('resolveDefaultClaimFaxNumber', () => {
  it('prefers claim fax over company fax', () => {
    expect(
      resolveDefaultClaimFaxNumber({ claimFaxNumber: '0505-111-2222', faxNumber: '02-1234-5678' }),
    ).toBe('0505-111-2222')
  })

  it('falls back to company fax', () => {
    expect(resolveDefaultClaimFaxNumber({ faxNumber: '02-1234-5678' })).toBe('02-1234-5678')
  })

  it('returns empty when no fax configured', () => {
    expect(resolveDefaultClaimFaxNumber({})).toBe('')
  })
})

describe('filterTemplateFormFields', () => {
  it('keeps coordinate fields and excludes signature or sender roles', () => {
    const fields = filterTemplateFormFields([
      { fieldKey: 'claim_id_card_issued_date', label: '신분증 발급일자', fieldType: 'date', required: true },
      { fieldKey: 'insured_name', label: '피보험자 이름', fieldType: 'text', required: true },
      { fieldKey: 'claim_claim_type', label: '청구유형', fieldType: 'radio', required: true },
      { fieldKey: 'insured_signature', label: '서명', fieldType: 'signature', required: true },
      { fieldKey: 'sender_fax', label: '발송 팩스', fieldType: 'text', inputRole: 'sender' },
    ])
    expect(fields.map((field) => field.fieldKey)).toEqual([
      'claim_id_card_issued_date',
      'insured_name',
      'claim_claim_type',
    ])
  })
})

describe('filterTemplateFieldsForEntry', () => {
  it('hides contractor fields when contractorSameAsInsured is true', () => {
    const fields = [
      { fieldKey: 'insured_name', label: '피보험자 이름', fieldType: 'text', required: true },
      { fieldKey: 'contractor_name', label: '계약자 이름', fieldType: 'text', required: true },
      { fieldKey: 'claim_same_as_insured', label: '동일 여부', fieldType: 'radio', required: true },
    ]
    expect(filterTemplateFieldsForEntry(fields, true).map((field) => field.fieldKey)).toEqual(['insured_name'])
    expect(filterTemplateFieldsForEntry(fields, false).map((field) => field.fieldKey)).toEqual([
      'insured_name',
      'contractor_name',
    ])
  })
})

describe('claimDataKeyFromFieldKey', () => {
  it('maps claim field key to claimData property', () => {
    expect(claimDataKeyFromFieldKey('claim_accident_location')).toBe('accidentLocation')
  })
})
