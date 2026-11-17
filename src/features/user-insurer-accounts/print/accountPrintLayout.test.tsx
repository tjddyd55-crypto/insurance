import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AccountPrintLayout } from './AccountPrintLayout'
import { getAccountPrintCss } from './accountPrintStyles'
import { buildAccountPrintData, PRINT_ROWS_HEIGHT, selectPrintDensity } from './accountPrintLayout'
import { fitAccountPrintSheet } from './fitAccountPrintSheet'
import { PRINT_HEIGHT, PRINT_WIDTH } from './accountPrintLayout'
import type { UserInsurerAccountRow } from '../api/userInsurerAccountsApi'

const row = (category: string, companyName: string, loginId = '', loginPassword = '') =>
  ({ category, companyName, loginId, loginPassword }) as UserInsurerAccountRow

describe('account A4 print', () => {
  it.each(['landscape', 'portrait'] as const)('chooses density boundaries for %s', (orientation) => {
    const rowsHeight = PRINT_ROWS_HEIGHT[orientation]
    const normal = Math.floor(rowsHeight / 26)
    const compact = Math.floor(rowsHeight / 23)
    const extra = Math.floor(rowsHeight / 20)
    expect(selectPrintDensity(0, orientation).name).toBe('NORMAL')
    expect(selectPrintDensity(normal, orientation).name).toBe('NORMAL')
    expect(selectPrintDensity(normal + 1, orientation).name).toBe('COMPACT')
    expect(selectPrintDensity(compact, orientation).name).toBe('COMPACT')
    expect(selectPrintDensity(compact + 1, orientation).name).toBe('EXTRA_COMPACT')
    expect(selectPrintDensity(extra, orientation).name).toBe('EXTRA_COMPACT')
    for (const count of [extra + 1, 100, 1000]) {
      const density = selectPrintDensity(count, orientation)
      expect(density.name).toBe('FALLBACK')
      expect(density.rowHeight * count).toBeLessThanOrEqual(rowsHeight + 0.00001)
      expect(density.fontSize).toBeLessThan(8)
    }
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
      const sheet = { style: {}, offsetWidth: width, scrollWidth: width, offsetHeight: height, scrollHeight: height }
      const root = { querySelector: () => sheet } as unknown as HTMLElement
      fitAccountPrintSheet(root, orientation)
      const scale = Number((sheet.style as { transform: string }).transform.match(/scale\((.*)\)/)?.[1])
      expect(width * scale).toBeLessThanOrEqual(PRINT_WIDTH[orientation])
      expect(height * scale).toBeLessThanOrEqual(PRINT_HEIGHT[orientation])
      fitAccountPrintSheet(root, orientation)
      expect((sheet.style as { transform: string }).transform).toBe(`scale(${scale})`)
    }
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
