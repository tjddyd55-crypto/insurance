import { describe, expect, it } from 'vitest'
import {
  buildCustomerMapGroupMarkerHtml,
  buildCustomerMapMarkerHtml,
  CUSTOMER_MAP_NAME_MARKER_SIZE,
  truncateMarkerLabel,
} from './customerMapMarkerHtml'

describe('CUSTOMER_MAP_NAME_MARKER_SIZE', () => {
  it('keeps anchor at horizontal center and fixed pin area', () => {
    expect(CUSTOMER_MAP_NAME_MARKER_SIZE.anchorX).toBe(CUSTOMER_MAP_NAME_MARKER_SIZE.width / 2)
    expect(CUSTOMER_MAP_NAME_MARKER_SIZE.anchorY).toBeLessThan(CUSTOMER_MAP_NAME_MARKER_SIZE.height)
  })
})

describe('truncateMarkerLabel', () => {
  it('truncates long names with ellipsis', () => {
    expect(truncateMarkerLabel('가나다라마바사아자차카타파하')).toBe('가나다라마바사아자차카타…')
  })

  it('uses fallback for empty names', () => {
    expect(truncateMarkerLabel('   ')).toBe('이름 없음')
  })
})

describe('buildCustomerMapMarkerHtml', () => {
  it('renders fixed-size name marker wrapper and selected modifier', () => {
    const html = buildCustomerMapMarkerHtml('박성용', true)
    expect(html).toContain('customer-map-name-marker--selected')
    expect(html).toContain('customer-map-name-marker__label')
    expect(html).toContain('customer-map-name-marker__pin')
    expect(html).toContain('박성용')
    expect(html).not.toContain('customer-map-marker__no')
  })

  it('escapes html in customer names', () => {
    const html = buildCustomerMapMarkerHtml('<script>', false)
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })
})

describe('buildCustomerMapGroupMarkerHtml', () => {
  it('renders count badge for multi-customer groups', () => {
    const html = buildCustomerMapGroupMarkerHtml('3명', 3, true)
    expect(html).toContain('customer-map-name-marker--group')
    expect(html).toContain('customer-map-name-marker__count')
    expect(html).toContain('>3<')
  })

  it('omits count badge for single-customer groups', () => {
    const html = buildCustomerMapGroupMarkerHtml('김도훈', 1, false)
    expect(html).not.toContain('customer-map-name-marker__count')
  })
})
