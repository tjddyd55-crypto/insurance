import { describe, expect, it } from 'vitest'
import {
  clearCustomerMapSelection,
  isCustomerMapMarkerCardOpen,
  shouldOpenMarkerCardOnRecenter,
  shouldRestorePathCustomerSelection,
} from './customerMapSelection'

describe('clearCustomerMapSelection', () => {
  it('clears selected ids and cluster key', () => {
    expect(clearCustomerMapSelection()).toEqual({
      selectedCustomerId: null,
      selectedGroupKey: null,
    })
  })
})

describe('isCustomerMapMarkerCardOpen', () => {
  it('is closed when selection empty', () => {
    expect(
      isCustomerMapMarkerCardOpen({ selectedCustomerId: null, selectedGroupKey: null }),
    ).toBe(false)
  })

  it('is open when group or customer selected', () => {
    expect(
      isCustomerMapMarkerCardOpen({ selectedCustomerId: 556, selectedGroupKey: null }),
    ).toBe(true)
    expect(
      isCustomerMapMarkerCardOpen({ selectedCustomerId: null, selectedGroupKey: '37.5,127.0' }),
    ).toBe(true)
  })
})

describe('shouldRestorePathCustomerSelection', () => {
  const base = {
    openDetailInWorkspaceMap: true,
    pathCustomerId: 556,
    selectedCustomerId: null as number | null,
    userDismissedMarkerCard: false,
    pathCustomerHasValidMarker: true,
  }

  it('allows one-time restore when selection empty and not dismissed', () => {
    expect(shouldRestorePathCustomerSelection(base)).toBe(true)
  })

  it('does not reopen after user dismissed the marker card', () => {
    expect(
      shouldRestorePathCustomerSelection({
        ...base,
        userDismissedMarkerCard: true,
      }),
    ).toBe(false)
  })

  it('does not restore when selection already present', () => {
    expect(
      shouldRestorePathCustomerSelection({
        ...base,
        selectedCustomerId: 556,
      }),
    ).toBe(false)
  })

  it('does not restore on menu map', () => {
    expect(
      shouldRestorePathCustomerSelection({
        ...base,
        openDetailInWorkspaceMap: false,
      }),
    ).toBe(false)
  })
})

describe('shouldOpenMarkerCardOnRecenter', () => {
  it('keeps card closed after dismiss when recentering', () => {
    expect(
      shouldOpenMarkerCardOnRecenter({ selectedCustomerId: null, selectedGroupKey: null }),
    ).toBe(false)
  })

  it('keeps card open when already selected', () => {
    expect(
      shouldOpenMarkerCardOnRecenter({ selectedCustomerId: 556, selectedGroupKey: 'k' }),
    ).toBe(true)
  })
})
