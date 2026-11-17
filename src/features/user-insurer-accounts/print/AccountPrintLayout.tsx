import type { CSSProperties } from 'react'
import { getAccountPrintVariables, selectPrintDensity, type AccountPrintData } from './accountPrintLayout'

/** Pure layout: fake rows can be rendered without auth, API, or application shell. */
export function AccountPrintLayout({ life, nonlife, orientation = 'landscape' }: AccountPrintData) {
  const density = selectPrintDensity(Math.max(life.length, nonlife.length), orientation)
  const style = {
    '--account-print-width': orientation === 'portrait' ? '196mm' : '283mm',
    ...getAccountPrintVariables(density),
  } as CSSProperties
  return (
    <article className="account-a4-sheet" data-print-rows={Math.max(life.length, nonlife.length)} style={style}>
      <h1>ONE FC 보험사 계정 목록</h1>
      <div className="account-a4-columns">
        {([{ title: '생명보험', rows: life }, { title: '손해보험', rows: nonlife }]).map(({ title, rows }) => (
          <section key={title}>
            <h2>{title}</h2>
            <table>
              <colgroup><col style={{ width: orientation === 'portrait' ? '28%' : '25%' }} /><col style={{ width: orientation === 'portrait' ? '32%' : '35%' }} /><col style={{ width: '40%' }} /></colgroup>
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
