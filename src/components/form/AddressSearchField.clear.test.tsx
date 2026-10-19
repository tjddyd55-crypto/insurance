import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import AddressSearchField from './AddressSearchField'
import { emptyAddressSearchValue, hasAddressSearchValue } from './addressSearchUtils'

const FILLED = {
  zonecode: '04524',
  baseAddress: '서울 중구 세종대로 110 (서울특별시청)',
  detailAddress: '3층',
  sido: '서울',
  sigungu: '중구',
  regionCaptured: true,
}

function clearButtonTag(html: string): string | undefined {
  return (html.match(/<button[^>]*>/g) ?? []).find((tag) => tag.includes('customer-address-field__clear'))
}

describe('AddressSearchField clearable (opt-in)', () => {
  it('does not render a clear button by default (customer forms unchanged)', () => {
    const html = renderToStaticMarkup(<AddressSearchField value={FILLED} onChange={() => {}} />)
    expect(html).toContain('주소 검색')
    expect(html).not.toContain('주소 지우기')
    expect(html).not.toContain('customer-address-field__search-row--with-clear')
  })

  it('renders 주소 지우기 next to 주소 검색 when clearable', () => {
    const html = renderToStaticMarkup(<AddressSearchField value={FILLED} onChange={() => {}} clearable />)
    expect(html).toContain('customer-address-field__search-row--with-clear')
    expect(html.indexOf('주소 검색')).toBeLessThan(html.indexOf('주소 지우기'))
    const clear = clearButtonTag(html)
    expect(clear).toBeTruthy()
    expect(clear).not.toMatch(/\sdisabled/)
  })

  it('disables 주소 지우기 when there is nothing to clear', () => {
    const html = renderToStaticMarkup(
      <AddressSearchField value={emptyAddressSearchValue()} onChange={() => {}} clearable />,
    )
    expect(clearButtonTag(html)).toMatch(/\sdisabled/)
  })

  it('hides the clear button in builder preview mode', () => {
    const html = renderToStaticMarkup(
      <AddressSearchField value={FILLED} onChange={() => {}} clearable previewStatic />,
    )
    expect(html).not.toContain('주소 지우기')
  })
})

describe('emptyAddressSearchValue / hasAddressSearchValue', () => {
  it('clears zonecode, base, detail and region fields', () => {
    expect(emptyAddressSearchValue()).toEqual({
      zonecode: '',
      baseAddress: '',
      detailAddress: '',
      sido: '',
      sigungu: '',
      eupmyeondong: '',
      regionCaptured: false,
    })
  })

  it('reports whether any part is filled', () => {
    expect(hasAddressSearchValue(FILLED)).toBe(true)
    expect(hasAddressSearchValue({ zonecode: '', baseAddress: '', detailAddress: '  ' })).toBe(false)
    expect(hasAddressSearchValue({ zonecode: '', baseAddress: '', detailAddress: '', sido: '서울' })).toBe(true)
    expect(hasAddressSearchValue(null)).toBe(false)
  })
})

describe('mobile card editor opts in', () => {
  it('MyPublicProfilePage passes clearable to the office AddressSearchField', async () => {
    const { readFileSync } = await import('node:fs')
    const { dirname, join } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../features/public-advisor/pages/MyPublicProfilePage.tsx'),
      'utf8',
    )
    expect(src).toMatch(/<AddressSearchField value=\{address\} onChange=\{setAddress\} clearable \/>/)
  })
})
