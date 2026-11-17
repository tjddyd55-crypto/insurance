import { PRINT_HEIGHT, PRINT_WIDTH, type PrintOrientation } from './accountPrintLayout'

/** Fit wrapped credentials without changing the sheet's layout or losing text. */
export function fitAccountPrintSheet(root: HTMLElement, orientation: PrintOrientation = 'landscape') {
  const sheet = root.querySelector<HTMLElement>('.account-a4-sheet')
  if (!sheet) return

  sheet.style.transform = 'none'
  const height = Math.max(sheet.offsetHeight, sheet.scrollHeight)
  const width = Math.max(sheet.offsetWidth, sheet.scrollWidth)
  const scale = Math.min(1, (PRINT_HEIGHT[orientation] - 4) / height, PRINT_WIDTH[orientation] / width)
  sheet.style.transformOrigin = 'top left'
  sheet.style.transform = `scale(${scale})`
}
