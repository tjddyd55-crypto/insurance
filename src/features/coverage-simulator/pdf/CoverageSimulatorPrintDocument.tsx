import { categoryLabel } from '../domain/itemCatalog'
import { PDF_DISCLAIMER_LINES } from '../domain/pdfCopy'
import { formatCoverageAmountLabel, formatTotalAmountLabel } from '../domain/formatAmount'
import { calculateScenarioTotals } from '../domain/totals'
import type { CoverageScenario } from '../domain/types'
import './printDocument.css'

type CoverageSimulatorPrintDocumentProps = {
  scenario: CoverageScenario
}

export function CoverageSimulatorPrintDocument({ scenario }: CoverageSimulatorPrintDocumentProps) {
  const totals = calculateScenarioTotals(scenario)
  const items = scenario.items.slice().sort((a, b) => a.order - b.order)

  return (
    <div className="coverage-simulator-print-root" data-testid="coverage-simulator-print-root">
      <header className="coverage-simulator-print-header">
        <h1>보장 시뮬레이션</h1>
        <p>
          {scenario.title}
          {scenario.customerName ? ` · ${scenario.customerName}` : ''} · 상담일 {scenario.consultationDate}
        </p>
      </header>

      <table className="coverage-simulator-print-table">
        <thead>
          <tr>
            <th style={{ width: '12%' }}>구분</th>
            <th style={{ width: '28%' }}>항목</th>
            <th style={{ width: '30%' }}>기존 보장</th>
            <th style={{ width: '30%' }}>제안 보장</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            if (item.type === 'time-marker') {
              return (
                <tr key={item.id} className="coverage-simulator-print-marker">
                  <td colSpan={4}>🕐 {item.label}</td>
                </tr>
              )
            }
            return (
              <tr key={item.id} className="coverage-simulator-print-row">
                <td>{categoryLabel(item.category)}</td>
                <td>
                  <strong>{item.label}</strong>
                  {item.memo ? <div style={{ color: '#6b7280', marginTop: 4 }}>{item.memo}</div> : null}
                </td>
                <td>{formatCoverageAmountLabel(item.currentAmount)}</td>
                <td style={{ color: '#1d4ed8', fontWeight: 700 }}>
                  {formatCoverageAmountLabel(item.proposedAmount)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <section className="coverage-simulator-print-summary">
        <div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>기존 총 보장금액 (입력 항목 합계)</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{formatTotalAmountLabel(totals.currentTotal)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>제안 총 보장금액 (입력 항목 합계)</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1d4ed8' }}>
            {formatTotalAmountLabel(totals.proposedTotal)}
          </div>
        </div>
      </section>

      <footer className="coverage-simulator-print-footer">
        {PDF_DISCLAIMER_LINES.map((line) => (
          <p key={line} style={{ margin: '0 0 4px' }}>{line}</p>
        ))}
      </footer>
    </div>
  )
}
