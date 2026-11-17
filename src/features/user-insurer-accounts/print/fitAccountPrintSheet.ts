import { PRINT_HEIGHT } from './accountPrintLayout'

/** Fit wrapped credentials without changing the sheet's layout or losing text. */
export function fitAccountPrintSheet(root: HTMLElement) {
  const sheet = root.querySelector<HTMLElement>('.account-a4-sheet')
  if (!sheet) return

  sheet.style.transform = 'none'
  const height = sheet.offsetHeight
  const scale = Math.min(1, (PRINT_HEIGHT - 4) / height)
  sheet.style.transformOrigin = 'top left'
  sheet.style.transform = `scale(${scale})`
}
