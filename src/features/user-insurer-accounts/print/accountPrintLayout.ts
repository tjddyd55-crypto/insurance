import type { UserInsurerAccountRow } from '../api/userInsurerAccountsApi'

export type AccountPrintRow = { company: string; loginId: string; password: string }
export type AccountPrintData = { life: AccountPrintRow[]; nonlife: AccountPrintRow[] }

// 196mm printable height at 96dpi; reserve 36px title, 28px section,
// 26px table header and 4px rounding/borders.
export const PRINT_HEIGHT = (210 - 2 * 7) * 96 / 25.4
export const PRINT_ROWS_HEIGHT = PRINT_HEIGHT - 94
const PRESETS = [
  { name: 'NORMAL', fontSize: 10, rowHeight: 26 },
  { name: 'COMPACT', fontSize: 9, rowHeight: 23 },
  { name: 'EXTRA_COMPACT', fontSize: 8, rowHeight: 20 },
] as const

export function selectPrintDensity(rowCount: number) {
  const count = Math.max(0, rowCount)
  for (const preset of PRESETS) {
    if (count * preset.rowHeight <= PRINT_ROWS_HEIGHT) return preset
  }
  const rowHeight = PRINT_ROWS_HEIGHT / count
  return { name: 'FALLBACK', fontSize: 8 * rowHeight / 20, rowHeight }
}

/** Preserve the screen's array order (including newly appended custom accounts).
 * Filter before reading/copying credentials; GENERAL never enters print data.
 */
export function buildAccountPrintData(accounts: readonly UserInsurerAccountRow[]): AccountPrintData {
  const data: AccountPrintData = { life: [], nonlife: [] }
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
