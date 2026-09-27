import { describe, expect, it } from 'vitest'

import { formatCustomerSearchBirthLabel } from './CustomerRelationSearchResultList'

describe('formatCustomerSearchBirthLabel', () => {
  it('formats API birthDate the same way as the CRM birth date label', () => {
    expect(formatCustomerSearchBirthLabel('1990-01-02')).toBe('1990.01.02')
    expect(formatCustomerSearchBirthLabel('19830603')).toBe('1983.06.03')
  })

  it('shows a dash when birthDate is missing', () => {
    expect(formatCustomerSearchBirthLabel(null)).toBe('-')
    expect(formatCustomerSearchBirthLabel('')).toBe('-')
    expect(formatCustomerSearchBirthLabel('   ')).toBe('-')
  })
})
