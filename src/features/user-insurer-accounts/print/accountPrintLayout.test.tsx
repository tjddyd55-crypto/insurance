import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AccountPrintLayout } from './AccountPrintLayout'
import { buildAccountPrintData, PRINT_ROWS_HEIGHT, selectPrintDensity } from './accountPrintLayout'
import type { UserInsurerAccountRow } from '../api/userInsurerAccountsApi'

const row = (category: string, companyName: string, loginId = '', loginPassword = '') =>
  ({ category, companyName, loginId, loginPassword }) as UserInsurerAccountRow

describe('account A4 print', () => {
  it('chooses the largest density at each printable-height boundary', () => {
    const normal = Math.floor(PRINT_ROWS_HEIGHT / 26)
    const compact = Math.floor(PRINT_ROWS_HEIGHT / 23)
    const extra = Math.floor(PRINT_ROWS_HEIGHT / 20)
    expect([normal, compact, extra]).toEqual([24, 28, 32])
    expect(selectPrintDensity(0).name).toBe('NORMAL')
    expect(selectPrintDensity(normal).name).toBe('NORMAL')
    expect(selectPrintDensity(normal + 1).name).toBe('COMPACT')
    expect(selectPrintDensity(compact).name).toBe('COMPACT')
    expect(selectPrintDensity(compact + 1).name).toBe('EXTRA_COMPACT')
    expect(selectPrintDensity(extra).name).toBe('EXTRA_COMPACT')
    for (const count of [extra + 1, 100, 1000]) {
      const density = selectPrintDensity(count)
      expect(density.name).toBe('FALLBACK')
      expect(density.rowHeight * count).toBeLessThanOrEqual(PRINT_ROWS_HEIGHT + 0.00001)
      expect(density.fontSize).toBeLessThan(8)
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
