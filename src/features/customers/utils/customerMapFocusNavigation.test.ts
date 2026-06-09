import { describe, expect, it } from 'vitest'
import {
  buildCustomerMapFocusPath,
  parseFocusCustomerId,
  parseFocusZoom,
} from './customerMapFocusNavigation'

describe('parseFocusCustomerId', () => {
  it('parses positive integer ids', () => {
    expect(parseFocusCustomerId('191')).toBe(191)
    expect(parseFocusCustomerId('1')).toBe(1)
  })

  it('rejects invalid ids', () => {
    expect(parseFocusCustomerId(null)).toBeNull()
    expect(parseFocusCustomerId('')).toBeNull()
    expect(parseFocusCustomerId('0')).toBeNull()
    expect(parseFocusCustomerId('abc')).toBeNull()
  })
})

describe('parseFocusZoom', () => {
  it('parses zoom in range', () => {
    expect(parseFocusZoom('15')).toBe(15)
    expect(parseFocusZoom('1')).toBe(1)
  })

  it('rejects invalid zoom', () => {
    expect(parseFocusZoom(null)).toBeNull()
    expect(parseFocusZoom('0')).toBeNull()
    expect(parseFocusZoom('25')).toBeNull()
  })
})

describe('buildCustomerMapFocusPath', () => {
  it('builds focusCustomerId query path', () => {
    expect(buildCustomerMapFocusPath(191)).toBe('/customers/map?focusCustomerId=191&zoom=15')
    expect(buildCustomerMapFocusPath(42, { zoom: 12 })).toBe(
      '/customers/map?focusCustomerId=42&zoom=12',
    )
  })
})
