import { useMemo } from 'react'

import { CoverageScenarioTimeline } from '../components/center-timeline/CoverageScenarioTimeline'
import { buildCoverageTimelineViewModel } from '../domain/buildCoverageTimelineViewModel'
import { diseaseTypeTitle } from '../domain/diseaseTypeLabels'
import { resolveCustomerNameSnapshot } from '../domain/normalizeConsultation'
import { PDF_DISCLAIMER_LINES } from '../domain/pdfCopy'
import type { CoverageScenario } from '../domain/types'
import '../styles/center-timeline.css'
import '../styles/onefc-token-bridge.css'
import '../styles/tokens.css'
import './printDocument.css'

type CoverageSimulatorPrintDocumentProps = {
  scenario: CoverageScenario
}

function formatPrintDate(consultationDate: string | undefined): string {
  const raw = (consultationDate ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw || '—'
  const [year, month, day] = raw.split('-')
  return `${year}.${month}.${day}`
}

export function CoverageSimulatorPrintDocument({ scenario }: CoverageSimulatorPrintDocumentProps) {
  const viewModel = useMemo(
    () => buildCoverageTimelineViewModel(scenario, { compactInsert: true }),
    [scenario],
  )
  const customerName = resolveCustomerNameSnapshot(scenario)
  const diseaseTitle = diseaseTypeTitle(scenario.diseaseType)

  return (
    <div
      className="coverage-simulator-print-root coverage-simulator-root coverage-simulator-root--mobile-preview"
      data-testid="coverage-simulator-print-root"
    >
      <header className="cs-print-doc-header">
        <h1 className="cs-print-doc-header__title">보장 시뮬레이션</h1>
        <p className="cs-print-doc-header__subtitle">
          {diseaseTitle}
          {scenario.title ? ` — ${scenario.title}` : ''}
        </p>
        <div className="cs-print-doc-header__meta">
          {customerName ? <span>고객: {customerName}</span> : null}
          <span>작성일 {formatPrintDate(scenario.consultationDate)}</span>
        </div>
      </header>

      <div className="cs-print-timeline-body">
        <CoverageScenarioTimeline mode="print" viewModel={viewModel} variant="mobile" showGrandTotal />
      </div>

      <footer className="cs-print-disclaimer">
        {PDF_DISCLAIMER_LINES.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <p className="cs-print-disclaimer__service">ONE FC 보장 시뮬레이션 · 상담 참고용</p>
      </footer>
    </div>
  )
}
