import { createPrintDensity, getAccountPrintVariables, MIN_PRINT_FONT, PRINT_FIT_RESERVE, PRINT_FONT_STEP, PRINT_HEIGHT, PRINT_WIDTH, selectPrintDensity, type PrintOrientation } from './accountPrintLayout'

const PRINT_FIT_TOLERANCE = 2 // CSS pixels; layout dimensions are integer-rounded.

/** Measure text in place so the browser uses the actual font (including Korean fallback).
 * Reserve full borders and a pixel for subpixel column rounding.
 */
function fitSingleLineColumns(sheet: HTMLElement) {
  let fits = true
  for (const table of sheet.querySelectorAll<HTMLTableElement>('table')) {
    const natural = [0, 0, 0]
    for (const row of table.rows) {
      for (const [index, cell] of Array.from(row.cells).entries()) {
        const style = getComputedStyle(cell)
        const range = cell.ownerDocument.createRange()
        range.selectNodeContents(cell)
        const width = range.getBoundingClientRect().width +
          parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) +
          parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth) + 1
        natural[index] = Math.max(natural[index], width)
      }
    }
    const total = natural.reduce((sum, width) => sum + width, 0)
    const available = table.getBoundingClientRect().width - 1
    if (total > available) { fits = false; continue }
    const columns = table.querySelectorAll<HTMLTableColElement>('col')
    columns.forEach((column, index) => {
      column.style.width = `${natural[index] + (available - total) * natural[index] / total}px`
    })
  }
  return fits
}

/** Reflow single-line credentials before using the final no-clipping scale safeguard. */
export function fitAccountPrintSheet(root: HTMLElement, orientation: PrintOrientation = 'landscape') {
  const sheet = root.querySelector<HTMLElement>('.account-a4-sheet')
  if (!sheet) return

  sheet.style.transform = 'none'
  let density = selectPrintDensity(Number(sheet.dataset.printRows ?? 0), orientation)
  // Keep the pure selector's FALLBACK contract; runtime wraps at 8px then scales.
  if (density.fontSize < MIN_PRINT_FONT) density = createPrintDensity(MIN_PRINT_FONT)
  const cells = sheet.querySelectorAll<HTMLElement>('td, th')
  const columns = sheet.querySelectorAll<HTMLTableColElement>('col')
  const ratioWidths = Array.from(columns, column => column.getAttribute('data-ratio-width') ?? column.style.width)
  columns.forEach((column, index) => column.setAttribute('data-ratio-width', ratioWidths[index]))
  const setWrapping = (wrap: boolean) => cells.forEach(cell => {
    cell.style.whiteSpace = wrap ? 'normal' : 'pre'
  })
  setWrapping(false)
  const availableHeight = PRINT_HEIGHT[orientation] - PRINT_FIT_RESERVE
  let height: number
  let width: number
  for (;;) {
    for (const [property, value] of Object.entries(getAccountPrintVariables(density))) {
      sheet.style.setProperty(property, value)
    }
    const fitsWidth = fitSingleLineColumns(sheet)
    // Reading layout here forces each updated typography scale to reflow synchronously.
    height = Math.max(sheet.offsetHeight, sheet.scrollHeight)
    width = Math.max(sheet.offsetWidth, sheet.scrollWidth)
    if (fitsWidth && height <= availableHeight && width <= PRINT_WIDTH[orientation] + PRINT_FIT_TOLERANCE) break
    if (density.fontSize <= MIN_PRINT_FONT) {
      if (!fitsWidth) {
        setWrapping(true)
        columns.forEach((column, index) => { column.style.width = ratioWidths[index] })
        height = Math.max(sheet.offsetHeight, sheet.scrollHeight)
        width = Math.max(sheet.offsetWidth, sheet.scrollWidth)
      }
      break
    }
    density = createPrintDensity(Math.max(MIN_PRINT_FONT, density.fontSize - PRINT_FONT_STEP))
  }
  const widthFactor = width > PRINT_WIDTH[orientation] + PRINT_FIT_TOLERANCE ? PRINT_WIDTH[orientation] / width : 1
  const scale = Math.min(1, availableHeight / height, widthFactor)
  sheet.style.transformOrigin = 'top left'
  sheet.style.transform = `scale(${scale})`
  return { density, scale }
}
