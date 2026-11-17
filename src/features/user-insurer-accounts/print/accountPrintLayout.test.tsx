import { describe, expect, it } from 'vitest'
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
    expect(markup).toContain('--account-print-pad-left:7px')
    expect(markup).toContain('--account-print-pad-right:4.2px')
    expect(getAccountPrintCss(orientation)).toContain('padding: 0 var(--account-print-pad-right) 0 var(--account-print-pad-left)')
  })
  it.each(['landscape', 'portrait'] as const)('maximizes nominal density for %s', orientation => {
    expect(selectPrintDensity(19, orientation).fontSize).toBe(orientation === 'landscape' ? 13 : 14)
    let previous = 14
    for (let count = 1; count <= 80; count++) {
      const density = selectPrintDensity(count, orientation)
      expect(density.fontSize).toBeLessThanOrEqual(previous)
      expect(getPrintNominalHeight(count, density)).toBeLessThanOrEqual(PRINT_HEIGHT[orientation] + 1e-8)
      if (density.name === 'AUTO' && density.fontSize < 14) {
        expect(getPrintNominalHeight(count, createPrintDensity(density.fontSize + 0.5))).toBeGreaterThan(PRINT_HEIGHT[orientation])
      }
      previous = density.fontSize
    }
    expect(selectPrintDensity(1000, orientation).name).toBe('FALLBACK')
    expect(selectPrintDensity(1000, orientation).fontSize).toBeLessThan(8)
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
      const sheet = { dataset: { printRows: '19' }, style: { setProperty() {} }, offsetWidth: width, scrollWidth: width, offsetHeight: height, scrollHeight: height }
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
    expect(applied).toEqual([14, 13.5, 13, 12.5, 12])
    applied.length = 0
    fitAccountPrintSheet(root, 'portrait')
    expect(applied[0]).toBe(14)
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
