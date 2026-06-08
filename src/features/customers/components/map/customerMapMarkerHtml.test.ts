import { describe, expect, it } from 'vitest'
import {
  buildCustomerMapMarkerHtml,
  truncateMarkerLabel,
} from './customerMapMarkerHtml'

describe('truncateMarkerLabel', () => {
  it('truncates long names with ellipsis', () => {
    expect(truncateMarkerLabel('가나다라마바사아자차카타파하')).toBe('가나다라마바사아자차…')
  })

  it('uses fallback for empty names', () => {
    expect(truncateMarkerLabel('   ')).toBe('이름 없음')
  })
})

describe('buildCustomerMapMarkerHtml', () => {
  it('renders name label chip and selected modifier', () => {
    const html = buildCustomerMapMarkerHtml('박성용', true)
    expect(html).toContain('customer-map-marker--selected')
    expect(html).toContain('customer-map-marker__label')
    expect(html).toContain('박성용')
    expect(html).not.toContain('customer-map-marker__no')
  })

  it('escapes html in customer names', () => {
    const html = buildCustomerMapMarkerHtml('<script>', false)
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })
})
