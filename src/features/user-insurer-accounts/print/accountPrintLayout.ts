import type { UserInsurerAccountRow } from '../api/userInsurerAccountsApi'

export type AccountPrintRow = { company: string; loginId: string; password: string }
export type PrintOrientation = 'landscape' | 'portrait'
export type AccountPrintData = { life: AccountPrintRow[]; nonlife: AccountPrintRow[]; orientation?: PrintOrientation }

// Printable A4 geometry at 96dpi, with 7mm margins on all sides.
export const PRINT_WIDTH = { landscape: 283 * 96 / 25.4, portrait: 196 * 96 / 25.4 }
export const PRINT_HEIGHT = { landscape: 196 * 96 / 25.4, portrait: 283 * 96 / 25.4 }
export const PRINT_FIT_RESERVE = 4
export const MAX_PRINT_FONT = 14
export const MIN_PRINT_FONT = 8
export const PRINT_FONT_STEP = 0.5

/** All geometry, including fallback geometry, shares one typography scale. */
export function createPrintDensity(fontSize: number) {
  const ratio = Math.min(1, fontSize / MIN_PRINT_FONT)
  const base = Math.max(MIN_PRINT_FONT, fontSize)
  const titleFontSize = Math.min(22, base + 7) * ratio
  const sectionFontSize = Math.min(18, base + 4) * ratio
  return {
    name: fontSize < MIN_PRINT_FONT ? 'FALLBACK' : 'AUTO',
    fontSize,
    rowHeight: Math.max(fontSize * 1.25, Math.round(base * 2.5) * ratio),
    headerFontSize: (base + 1) * ratio,
    titleFontSize,
    sectionFontSize,
    titleHeight: titleFontSize * 1.3 + fontSize * 0.4,
    sectionHeight: sectionFontSize * 1.3 + fontSize * 0.3,
  }
}

export function getPrintNominalHeight(rowCount: number, density: ReturnType<typeof createPrintDensity>) {
  return density.titleHeight + density.sectionHeight + (Math.max(0, rowCount) + 1) * density.rowHeight + PRINT_FIT_RESERVE
}

/** Shared by React and the synchronous browser fitter. */
export function getAccountPrintVariables(density: ReturnType<typeof createPrintDensity>) {
  const padding = getAccountPrintPadding(density.fontSize)
  return {
    '--account-print-pad-left': `${padding.left}px`,
    '--account-print-pad-right': `${padding.right}px`,
    '--account-print-font': `${density.fontSize}px`,
    '--account-print-row': `${density.rowHeight}px`,
    '--account-print-header-font': `${density.headerFontSize}px`,
    '--account-print-title-font': `${density.titleFontSize}px`,
    '--account-print-section-font': `${density.sectionFontSize}px`,
    '--account-print-title-height': `${density.titleHeight}px`,
    '--account-print-section-height': `${density.sectionHeight}px`,
  }
}

export function getAccountPrintPadding(fontSize: number) {
  const left = Math.max(2, fontSize * 0.5)
  return { left, right: Math.round(left * 0.6 * 10) / 10 }
}

export function selectPrintDensity(rowCount: number, orientation: PrintOrientation = 'landscape') {
  for (let f = MAX_PRINT_FONT; f >= MIN_PRINT_FONT; f -= PRINT_FONT_STEP) {
    const density = createPrintDensity(f)
    if (getPrintNominalHeight(rowCount, density) <= PRINT_HEIGHT[orientation]) return density
  }
  const minimum = createPrintDensity(MIN_PRINT_FONT)
  const ratio = (PRINT_HEIGHT[orientation] - PRINT_FIT_RESERVE) /
    (getPrintNominalHeight(rowCount, minimum) - PRINT_FIT_RESERVE)
  return createPrintDensity(MIN_PRINT_FONT * ratio)
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
