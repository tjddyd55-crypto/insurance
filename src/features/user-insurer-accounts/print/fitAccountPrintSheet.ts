import { createPrintDensity, getAccountPrintVariables, MIN_PRINT_FONT, PRINT_FIT_RESERVE, PRINT_FONT_STEP, PRINT_HEIGHT, PRINT_WIDTH, selectPrintDensity, type PrintOrientation } from './accountPrintLayout'

const PRINT_FIT_TOLERANCE = 2 // CSS pixels; layout dimensions are integer-rounded.

/** Reflow wrapped credentials before using the final no-clipping scale safeguard. */
export function fitAccountPrintSheet(root: HTMLElement, orientation: PrintOrientation = 'landscape') {
  const sheet = root.querySelector<HTMLElement>('.account-a4-sheet')
  if (!sheet) return

  sheet.style.transform = 'none'
  let density = selectPrintDensity(Number(sheet.dataset.printRows ?? 0), orientation)
  const availableHeight = PRINT_HEIGHT[orientation] - PRINT_FIT_RESERVE
  let height: number
  let width: number
  for (;;) {
    for (const [property, value] of Object.entries(getAccountPrintVariables(density))) {
      sheet.style.setProperty(property, value)
    }
    // Reading layout here forces each updated typography scale to reflow synchronously.
    height = Math.max(sheet.offsetHeight, sheet.scrollHeight)
    width = Math.max(sheet.offsetWidth, sheet.scrollWidth)
    if ((height <= availableHeight && width <= PRINT_WIDTH[orientation] + PRINT_FIT_TOLERANCE) || density.fontSize <= MIN_PRINT_FONT) break
    density = createPrintDensity(Math.max(MIN_PRINT_FONT, density.fontSize - PRINT_FONT_STEP))
  }
  const widthFactor = width > PRINT_WIDTH[orientation] + PRINT_FIT_TOLERANCE ? PRINT_WIDTH[orientation] / width : 1
  const scale = Math.min(1, availableHeight / height, widthFactor)
  sheet.style.transformOrigin = 'top left'
  sheet.style.transform = `scale(${scale})`
  return { density, scale }
}
