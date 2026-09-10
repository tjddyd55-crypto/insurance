import { describe, expect, it } from 'vitest'
import {
  createEmptyCustomerFireInsuranceLocation,
  ensureCustomerFireInsuranceLocationFormItems,
  normalizeCustomerFireInsuranceLocationsForSave,
} from './customerFireInsuranceLocationFormUtils'

describe('customerFireInsuranceLocationFormUtils', () => {
  it('filters empty locations on save', () => {
    const result = normalizeCustomerFireInsuranceLocationsForSave([
      { address: '서울', memo: '' },
      { address: '', memo: '' },
      { address: '', memo: '메모만' },
    ])
    expect(result).toHaveLength(2)
  })

  it('ensures at least one empty form item', () => {
    expect(ensureCustomerFireInsuranceLocationFormItems([])).toEqual([
      createEmptyCustomerFireInsuranceLocation(),
    ])
  })
})
