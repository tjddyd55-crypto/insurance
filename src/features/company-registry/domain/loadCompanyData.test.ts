import { describe, expect, it } from 'vitest'
import {
  isInsCompanyCode,
  isPersistedDirectoryCompanyCode,
  STATIC_COMPANY_CODE_PREFIX,
} from './companyCode'
import { findSavedEntryForSelection, loadCompanyData } from './loadCompanyData'
import type { CompanyDirectoryEntry } from './types'

function entry(
  partial: Partial<CompanyDirectoryEntry> & Pick<CompanyDirectoryEntry, 'id' | 'companyCode' | 'name'>,
): CompanyDirectoryEntry {
  return {
    category: 'LIFE',
    customerCenter: '',
    systemPhone: '',
    incallNumber: '',
    visitInfo: '',
    contacts: [],
    ...partial,
  }
}

describe('directory companyCode matching for seeded insurers', () => {
  it('isInsCompanyCode accepts only canonical INS+digits', () => {
    expect(isInsCompanyCode('INS000123')).toBe(true)
    expect(isInsCompanyCode('INS_SEED_011')).toBe(false)
    expect(isInsCompanyCode('INS_FHL_12')).toBe(false)
    expect(isInsCompanyCode(`${STATIC_COMPANY_CODE_PREFIX}LIFE:푸본현대생명`)).toBe(false)
  })

  it('isPersistedDirectoryCompanyCode includes seed and GA stub codes', () => {
    expect(isPersistedDirectoryCompanyCode('INS000123')).toBe(true)
    expect(isPersistedDirectoryCompanyCode('INS_SEED_011')).toBe(true)
    expect(isPersistedDirectoryCompanyCode('INS_FHL_12')).toBe(true)
    expect(isPersistedDirectoryCompanyCode(`${STATIC_COMPANY_CODE_PREFIX}LIFE:푸본현대생명`)).toBe(false)
    expect(isPersistedDirectoryCompanyCode('')).toBe(false)
  })

  it('findSavedEntryForSelection matches INS_SEED master rows', () => {
    const rows = [
      entry({
        id: 41,
        companyCode: 'INS_SEED_011',
        name: '푸본현대생명',
        customerCenter: '1577-3311',
      }),
    ]
    const found = findSavedEntryForSelection(rows, 'LIFE', 'INS_SEED_011')
    expect(found?.id).toBe(41)
    expect(found?.customerCenter).toBe('1577-3311')
  })

  it('findSavedEntryForSelection matches INS_FHL GA stub codes', () => {
    const rows = [entry({ id: 99, companyCode: 'INS_FHL_12', name: '푸본현대생명' })]
    expect(findSavedEntryForSelection(rows, 'LIFE', 'INS_FHL_12')?.id).toBe(99)
  })

  it('loadCompanyData keeps id/name/customerCenter for seeded selection (not blank new form)', () => {
    const rows = [
      entry({
        id: 41,
        companyCode: 'INS_SEED_011',
        name: '푸본현대생명',
        customerCenter: '1577-3311',
        contacts: [],
      }),
    ]
    const result = loadCompanyData(rows, 'LIFE', 'INS_SEED_011', { type: '', companyCode: '' })
    expect(result?.syncForm).toBe(true)
    if (!result || !result.syncForm) return
    expect(result.company.id).toBe(41)
    expect(result.company.name).toBe('푸본현대생명')
    expect(result.company.customerCenter).toBe('1577-3311')
    expect(result.company.companyCode).toBe('INS_SEED_011')
  })
})
