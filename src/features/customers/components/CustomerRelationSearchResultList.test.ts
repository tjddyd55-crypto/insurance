import { describe, expect, it } from 'vitest'

import { formatCustomerSearchBirthLabel } from './CustomerRelationSearchResultList'

describe('formatCustomerSearchBirthLabel', () => {
  it('formats API birthDate the same way as the CRM birth date label', () => {
    expect(formatCustomerSearchBirthLabel('1990-01-02')).toBe('1990.01.02')
    expect(formatCustomerSearchBirthLabel('19830603')).toBe('1983.06.03')
  })

  it('uses birthDate when only the column is present', () => {
    expect(formatCustomerSearchBirthLabel('1990-01-02', null)).toBe('1990.01.02')
    expect(formatCustomerSearchBirthLabel('1990-01-02', '   ')).toBe('1990.01.02')
  })

  it('derives from ssn when birthDate is empty', () => {
    expect(formatCustomerSearchBirthLabel(null, '840218-1234567')).toBe('1984.02.18')
    expect(formatCustomerSearchBirthLabel('', '8402181')).toBe('1984.02.18')
    expect(formatCustomerSearchBirthLabel('   ', '8402181******')).toBe('1984.02.18')
  })

  it('prefers birthDate when both birthDate and ssn are present', () => {
    expect(formatCustomerSearchBirthLabel('1990-01-02', '840218-1234567')).toBe('1990.01.02')
  })

  it('shows a dash when neither birthDate nor ssn yields a date', () => {
    expect(formatCustomerSearchBirthLabel(null)).toBe('-')
    expect(formatCustomerSearchBirthLabel('', '')).toBe('-')
    expect(formatCustomerSearchBirthLabel('   ', '840218')).toBe('-')
  })
})
