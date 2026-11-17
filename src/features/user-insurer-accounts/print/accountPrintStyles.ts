import type { PrintOrientation } from './accountPrintLayout'

// Mounted only during this print flow; other printing flows keep their own @page rules.
export const ACCOUNT_PRINT_CSS = `
#account-a4-print-root { position: absolute; left: 0; top: 0; visibility: hidden; pointer-events: none; }
.account-a4-sheet { width: var(--account-print-width); background: white; color: black; font-family: Arial, sans-serif; }
.account-a4-sheet * { box-sizing: border-box; color: black; }
.account-a4-sheet h1 { height: 36px; margin: 0; font-size: 17px; line-height: 28px; font-weight: bold; }
.account-a4-columns { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.account-a4-sheet h2 { height: 28px; margin: 0; font-size: 14px; line-height: 22px; font-weight: bold; }
.account-a4-sheet table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.account-a4-sheet table, .account-a4-sheet tr { break-inside: avoid; page-break-inside: avoid; page-break-before: avoid; page-break-after: avoid; }
.account-a4-sheet th { height: 26px; font-size: 11px; font-weight: bold; }
.account-a4-sheet td { height: var(--account-print-row); font-size: var(--account-print-font); line-height: 1.05; }
.account-a4-sheet td, .account-a4-sheet th { border: 0.5px solid black; padding: 0 var(--account-print-padding); letter-spacing: -0.2px; word-break: break-all; overflow-wrap: anywhere; white-space: normal; vertical-align: middle; }
@media print {
  html:has(#account-a4-print-root), body:has(#account-a4-print-root) { margin: 0 !important; padding: 0 !important; background: white !important; overflow: visible !important; height: auto !important; min-height: 0 !important; }
  body:has(#account-a4-print-root) > :not(#account-a4-print-root) { display: none !important; }
  #account-a4-print-root { display: block !important; position: static !important; visibility: visible !important; width: var(--account-print-root-width); height: var(--account-print-root-height); overflow: hidden; page-break-inside: avoid; break-inside: avoid; }
  #account-a4-print-root * { visibility: visible !important; }
  #account-a4-print-root ::-webkit-scrollbar { display: none; }
}
`

/** Only mount this style while printing; never leave a global @page rule behind. */
export function getAccountPrintCss(orientation: PrintOrientation = 'landscape') {
  const portrait = orientation === 'portrait'
  return ACCOUNT_PRINT_CSS + `
#account-a4-print-root { --account-print-root-width: ${portrait ? 196 : 283}mm; --account-print-root-height: ${portrait ? 283 : 196}mm; width: var(--account-print-root-width); }
@media print { @page { size: A4 ${orientation}; margin: 7mm; } }
`
}
