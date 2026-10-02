import { useMemo } from 'react'

import { CoverageScenarioTimeline } from '../components/center-timeline/CoverageScenarioTimeline'
import { buildCoverageTimelineViewModel } from '../domain/buildCoverageTimelineViewModel'
import { formatCoverageScenarioHeading } from '../domain/diseaseTypeLabels'
import { formatCoverageAuthoredDate } from '../domain/formatConsultationDate'
import { formatCoverageDocumentMetaLine } from '../domain/formatCoverageDocumentHeader'
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

export function CoverageSimulatorPrintDocument({ scenario }: CoverageSimulatorPrintDocumentProps) {
  const viewModel = useMemo(
    () => buildCoverageTimelineViewModel(scenario, { compactInsert: true }),
    [scenario],
  )
  const customerName = resolveCustomerNameSnapshot(scenario)
  const scenarioHeading = formatCoverageScenarioHeading(scenario.diseaseType, scenario.title)

  return (
    <div
      className="coverage-simulator-print-root coverage-simulator-print-root--korean-text-safe coverage-simulator-root coverage-simulator-root--mobile-preview"
      data-testid="coverage-simulator-print-root"
    >
      <header className="cs-print-doc-header">
        <h1 className="cs-print-doc-header__title">보장 시뮬레이션</h1>
        <p className="cs-print-doc-header__meta">
          {formatCoverageDocumentMetaLine(customerName, formatCoverageAuthoredDate(scenario, '—'))}
        </p>
        <p className="cs-print-doc-header__subtitle">{scenarioHeading}</p>
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
