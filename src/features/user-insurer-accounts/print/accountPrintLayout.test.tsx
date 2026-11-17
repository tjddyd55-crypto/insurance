import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AccountPrintLayout } from './AccountPrintLayout'
import { getAccountPrintCss } from './accountPrintStyles'
import { buildAccountPrintData, getAccountPrintPadding, createPrintDensity, getPrintNominalHeight, selectPrintDensity } from './accountPrintLayout'
import { fitAccountPrintSheet } from './fitAccountPrintSheet'
import { PRINT_HEIGHT, PRINT_WIDTH } from './accountPrintLayout'
import type { UserInsurerAccountRow } from '../api/userInsurerAccountsApi'

const row = (category: string, companyName: string, loginId = '', loginPassword = '') =>
  ({ category, companyName, loginId, loginPassword }) as UserInsurerAccountRow

describe('account A4 print', () => {
  it.each([
    [10, 5, 3],
    [9, 4.5, 2.7],
    [8, 4, 2.4],
    [6.25, 3.125, 1.9],
    [3, 2, 1.2],
  ])('computes cell padding for font size %s', (fontSize, left, right) => {
    expect(getAccountPrintPadding(fontSize)).toEqual({ left, right })
  })
  it.each(['landscape', 'portrait'] as const)('uses separate cell padding in %s', orientation => {
    const markup = renderToStaticMarkup(<AccountPrintLayout life={[]} nonlife={[]} orientation={orientation} />)
    expect(markup).toContain('--account-print-pad-left:10px')
    expect(markup).toContain('--account-print-pad-right:6px')
    expect(getAccountPrintCss(orientation)).toContain('padding: 0 var(--account-print-pad-right) 0 var(--account-print-pad-left)')
  })
  it.each(['landscape', 'portrait'] as const)('maximizes nominal density for %s', orientation => {
    expect(selectPrintDensity(19, orientation).fontSize).toBe(orientation === 'landscape' ? 13 : 19.5)
    let previous = 20
    for (let count = 1; count <= 80; count++) {
      const density = selectPrintDensity(count, orientation)
      expect(density.fontSize).toBeLessThanOrEqual(previous)
      expect(getPrintNominalHeight(count, density)).toBeLessThanOrEqual(PRINT_HEIGHT[orientation] + 1e-8)
      if (density.name === 'AUTO' && density.fontSize < 20) {
        expect(getPrintNominalHeight(count, createPrintDensity(density.fontSize + 0.5))).toBeGreaterThan(PRINT_HEIGHT[orientation])
      }
      previous = density.fontSize
    }
    expect(selectPrintDensity(1000, orientation).name).toBe('FALLBACK')
    expect(selectPrintDensity(1000, orientation).fontSize).toBeLessThan(8)
  })
  it('caps typography and fills portrait height with larger text', () => {
    expect(selectPrintDensity(19, 'portrait').fontSize).toBeGreaterThanOrEqual(18)
    expect(selectPrintDensity(1).fontSize).toBe(20)
    expect(createPrintDensity(20)).toMatchObject({ fontSize: 20, rowHeight: 50, titleFontSize: 27, sectionFontSize: 24, headerFontSize: 21 })
    expect(createPrintDensity(30)).toMatchObject({ titleFontSize: 28, sectionFontSize: 24 })
  })
  it('defaults to landscape and carries selected portrait through data and markup', () => {
    expect(buildAccountPrintData([]).orientation).toBe('landscape')
    const data = buildAccountPrintData([row('LIFE', 'Fake')], 'portrait')
    expect(data.orientation).toBe('portrait')
    const markup = renderToStaticMarkup(<AccountPrintLayout {...data} />)
    expect(markup).toContain('--account-print-width:196mm')
    expect(markup.indexOf('생명보험')).toBeLessThan(markup.indexOf('손해보험'))
    expect(markup).toContain('ONE FC 보험사 계정 목록')
    expect(markup).toContain('width:28%')
    for (const orientation of ['landscape', 'portrait'] as const) {
      const css = getAccountPrintCss(orientation)
      expect(css).toContain(`@page { size: A4 ${orientation}; margin: 7mm; }`)
      expect(css.match(/@page/g)).toHaveLength(1)
    }
  })
  it.each(['landscape', 'portrait'] as const)('fits wrapped height and overflowing width for %s', orientation => {
    for (const [width, height] of [[PRINT_WIDTH[orientation], PRINT_HEIGHT[orientation] * 2], [PRINT_WIDTH[orientation] * 2, 100]]) {
      const sheet = { querySelectorAll: () => [],
      dataset: { printRows: '19' }, style: { setProperty() {} }, offsetWidth: width, scrollWidth: width, offsetHeight: height, scrollHeight: height }
      const root = { querySelector: () => sheet } as unknown as HTMLElement
      fitAccountPrintSheet(root, orientation)
      const scale = Number((sheet.style as { transform: string }).transform.match(/scale\((.*)\)/)?.[1])
      expect(width * scale).toBeLessThanOrEqual(PRINT_WIDTH[orientation])
      expect(height * scale).toBeLessThanOrEqual(PRINT_HEIGHT[orientation])
      fitAccountPrintSheet(root, orientation)
      expect((sheet.style as { transform: string }).transform).toBe(`scale(${scale})`)
    }
  })
  it('reflows in half-pixel steps before scaling and resets on repeat fits', () => {
    let font = 0
    const applied: number[] = []
    const sheet = {
      querySelectorAll: () => [],
      dataset: { printRows: '19' },
      style: { setProperty(key: string, value: string) {
        if (key === '--account-print-font') { font = parseFloat(value); applied.push(font) }
      } },
      offsetWidth: 700, scrollWidth: 700,
      get offsetHeight() { return font > 12 ? 1200 : 900 },
      get scrollHeight() { return this.offsetHeight },
    }
    const root = { querySelector: () => sheet } as unknown as HTMLElement
    expect(fitAccountPrintSheet(root, 'portrait')?.scale).toBe(1)
    expect(applied).toEqual(Array.from({ length: 16 }, (_, i) => 19.5 - i * 0.5))
    applied.length = 0
    fitAccountPrintSheet(root, 'portrait')
    expect(applied[0]).toBe(19.5)
  })
  it.each([false, true])('fits natural column widths and wraps only at minimum (long=%s)', long => {
    let font = 0
    const columns = ['28%', '32%', '40%'].map(width => ({
      style: { width },
      getAttribute: () => null,
      setAttribute() {},
    }))
    const cells = [7, 9, 11].map(length => ({
      style: { whiteSpace: '' },
      ownerDocument: { createRange: () => ({
        selectNodeContents() {},
        getBoundingClientRect: () => ({ width: font * length * (long ? 10 : 1) }),
      }) },
    }))
    const table = {
      rows: [{ cells }],
      getBoundingClientRect: () => ({ width: 365 }),
      querySelectorAll: () => columns,
    }
    const sheet = {
      dataset: { printRows: '19' },
      style: { setProperty(key: string, value: string) { if (key === '--account-print-font') font = parseFloat(value) } },
      querySelectorAll: (selector: string) => selector === 'table' ? [table] : selector === 'col' ? columns : cells,
      offsetWidth: 741, scrollWidth: 741, offsetHeight: 900, scrollHeight: 900,
    }
    vi.stubGlobal('getComputedStyle', () => ({ paddingLeft: '4', paddingRight: '2.4', borderLeftWidth: '0.5', borderRightWidth: '0.5' }))
    try {
      const result = fitAccountPrintSheet({ querySelector: () => sheet } as unknown as HTMLElement, 'portrait')
      if (long) {
        expect(result?.density.fontSize).toBe(8)
        expect(cells.every(cell => cell.style.whiteSpace === 'normal')).toBe(true)
        expect(columns.map(column => column.style.width)).toEqual(['28%', '32%', '40%'])
      } else {
        expect(result?.density.fontSize).toBe(12.5)
        expect(cells.every(cell => cell.style.whiteSpace === 'pre')).toBe(true)
        const widths = columns.map(column => parseFloat(column.style.width))
        expect(widths.reduce((sum, width) => sum + width, 0)).toBeCloseTo(364)
        widths.forEach((width, index) => expect(width).toBeGreaterThanOrEqual(font * [7, 9, 11][index] + 8.4))
      }
    } finally { vi.unstubAllGlobals() }
  })
  it('excludes general/unknown before reading passwords and preserves screen order', () => {
    const general = row('GENERAL', 'excluded')
    Object.defineProperty(general, 'loginPassword', { get: () => { throw new Error('must not read') } })
    const data = buildAccountPrintData([row('LIFE', 'Z'), general, row('NON_LIFE', 'N'), row('LIFE', 'A'), row('OTHER', 'unknown')])
    expect(data.life.map(r => r.company)).toEqual(['Z', 'A'])
    expect(data.nonlife.map(r => r.company)).toEqual(['N'])
    expect(data.life[0]).toEqual({ company: 'Z', loginId: '미등록', password: '미등록' })
    expect(renderToStaticMarkup(<AccountPrintLayout {...data} />)).not.toContain('excluded')
  })
  it('keeps full credentials, including password whitespace, in the pure layout', () => {
    const password = ' fake password '.repeat(50)
    const data = buildAccountPrintData([row('LIFE', 'Fake', 'long-id'.repeat(50), password)])
    expect(data.life[0].password).toBe(password)
    expect(renderToStaticMarkup(<AccountPrintLayout {...data} />)).toContain(password)
    expect(buildAccountPrintData([row('LIFE', 'Fake', '   ')]).life[0].loginId).toBe('미등록')
  })
})
