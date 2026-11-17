import type { CSSProperties } from 'react'
import { selectPrintDensity, type AccountPrintData } from './accountPrintLayout'

/** Pure layout: fake rows can be rendered without auth, API, or application shell. */
export function AccountPrintLayout({ life, nonlife }: AccountPrintData) {
  const density = selectPrintDensity(Math.max(life.length, nonlife.length))
  const style = {
    '--account-print-font': `${density.fontSize}px`,
    '--account-print-row': `${density.rowHeight}px`,
  } as CSSProperties
  return (
    <article className="account-a4-sheet" style={style}>
      <h1>ONE FC 보험사 계정 목록</h1>
      <div className="account-a4-columns">
        {([{ title: '생명보험', rows: life }, { title: '손해보험', rows: nonlife }]).map(({ title, rows }) => (
          <section key={title}>
            <h2>{title}</h2>
            <table>
              <colgroup><col style={{ width: '25%' }} /><col style={{ width: '35%' }} /><col style={{ width: '40%' }} /></colgroup>
              <thead><tr><th>회사</th><th>아이디</th><th>비밀번호</th></tr></thead>
              <tbody>{rows.map((row, index) => (
                <tr key={index}><td>{row.company}</td><td>{row.loginId}</td><td>{row.password}</td></tr>
              ))}</tbody>
            </table>
          </section>
        ))}
      </div>
    </article>
  )
}

// Mounted only during this print flow; other printing flows keep their own @page rules.
export const ACCOUNT_PRINT_CSS = `
#account-a4-print-root { position: absolute; left: 0; top: 0; visibility: hidden; pointer-events: none; }
.account-a4-sheet { width: 283mm; background: white; color: black; font-family: Arial, sans-serif; }
.account-a4-sheet * { box-sizing: border-box; color: black; }
.account-a4-sheet h1 { height: 36px; margin: 0; font-size: 17px; line-height: 28px; font-weight: bold; }
.account-a4-columns { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.account-a4-sheet h2 { height: 28px; margin: 0; font-size: 14px; line-height: 22px; font-weight: bold; }
.account-a4-sheet table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.account-a4-sheet table, .account-a4-sheet tr { break-inside: avoid; page-break-inside: avoid; page-break-before: avoid; page-break-after: avoid; }
.account-a4-sheet th { height: 26px; font-size: 11px; font-weight: bold; }
.account-a4-sheet td { height: var(--account-print-row); font-size: var(--account-print-font); line-height: 1.05; }
.account-a4-sheet td, .account-a4-sheet th { border: 0.5px solid black; padding: 0 2px; letter-spacing: -0.2px; word-break: break-all; overflow-wrap: anywhere; white-space: normal; vertical-align: middle; }
@media print {
  @page { size: A4 landscape; margin: 7mm; }
  html:has(#account-a4-print-root), body:has(#account-a4-print-root) { margin: 0 !important; padding: 0 !important; background: white !important; overflow: visible !important; height: auto !important; min-height: 0 !important; }
  body:has(#account-a4-print-root) > :not(#account-a4-print-root) { display: none !important; }
  #account-a4-print-root { display: block !important; position: static !important; visibility: visible !important; width: 283mm; height: 196mm; overflow: hidden; page-break-inside: avoid; break-inside: avoid; }
  #account-a4-print-root * { visibility: visible !important; }
  #account-a4-print-root ::-webkit-scrollbar { display: none; }
}
`
