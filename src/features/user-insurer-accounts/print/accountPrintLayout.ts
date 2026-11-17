import type { UserInsurerAccountRow } from '../api/userInsurerAccountsApi'

export type AccountPrintRow = { company: string; loginId: string; password: string }
export type PrintOrientation = 'landscape' | 'portrait'
export type AccountPrintData = { life: AccountPrintRow[]; nonlife: AccountPrintRow[]; orientation?: PrintOrientation }

// Printable A4 geometry at 96dpi, with 7mm margins on all sides.
export const PRINT_WIDTH = { landscape: 283 * 96 / 25.4, portrait: 196 * 96 / 25.4 }
export const PRINT_HEIGHT = { landscape: 196 * 96 / 25.4, portrait: 283 * 96 / 25.4 }
// Reserve title, section heading, table header and rounding/borders.
export const PRINT_ROWS_HEIGHT = { landscape: PRINT_HEIGHT.landscape - 94, portrait: PRINT_HEIGHT.portrait - 94 }
const PRESETS = [
  { name: 'NORMAL', fontSize: 10, rowHeight: 26 },
  { name: 'COMPACT', fontSize: 9, rowHeight: 23 },
  { name: 'EXTRA_COMPACT', fontSize: 8, rowHeight: 20 },
] as const

export function selectPrintDensity(rowCount: number, orientation: PrintOrientation = 'landscape') {
  const rowsHeight = PRINT_ROWS_HEIGHT[orientation]
  const count = Math.max(0, rowCount)
  for (const preset of PRESETS) {
    if (count * preset.rowHeight <= rowsHeight) return preset
  }
  const rowHeight = rowsHeight / count
  return { name: 'FALLBACK', fontSize: 8 * rowHeight / 20, rowHeight }
}

/** Preserve the screen's array order (including newly appended custom accounts).
 * Filter before reading/copying credentials; GENERAL never enters print data.
 */
export function buildAccountPrintData(accounts: readonly UserInsurerAccountRow[], orientation: PrintOrientation = 'landscape'): AccountPrintData {
  const data: AccountPrintData = { life: [], nonlife: [], orientation }
  for (const row of accounts) {
    if (row.category !== 'LIFE' && row.category !== 'NON_LIFE') continue
    data[row.category === 'LIFE' ? 'life' : 'nonlife'].push({
      company: row.companyName,
      loginId: row.loginId?.trim() ? row.loginId : '미등록',
      password: row.loginPassword ? row.loginPassword : '미등록',
    })
  }
  return data
}
