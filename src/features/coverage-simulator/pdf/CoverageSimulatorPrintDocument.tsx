import { CoverageBadge } from '../components/CoverageBadge'
import { diseaseTypeTitle } from '../domain/diseaseTypeLabels'
import { formatCoverageAmountLabel, formatTotalAmountLabel } from '../domain/formatAmount'
import { resolveCustomerNameSnapshot } from '../domain/normalizeConsultation'
import { periodSubtotalLabelFromMarker } from '../domain/periodSubtotalLabel'
import { PDF_DISCLAIMER_LINES } from '../domain/pdfCopy'
import type { CoverageScenario, CoverageScenarioItem } from '../domain/types'
import { buildPrintTimelineModel } from './buildPrintTimelineModel'
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

function PrintCoverageItem({ item }: { item: CoverageScenarioItem }) {
  return (
    <article className="cs-print-item" data-testid="coverage-print-item">
      <div className="cs-print-item__head">
        <div className="cs-print-item__badge">
          <CoverageBadge category={item.category} />
        </div>
        <p className="cs-print-item__title">
          <span className="cs-print-item__title-mask">{item.label}</span>
        </p>
      </div>
      <div className="cs-print-item__amounts" aria-label={`${item.label} 기존 및 제안`}>
        <span className="cs-print-item__amount cs-print-item__amount--current">
          {formatCoverageAmountLabel(item.currentAmount)}
        </span>
        <span className="cs-print-item__spine" aria-hidden="true" />
        <span className="cs-print-item__amount cs-print-item__amount--proposed">
          {formatCoverageAmountLabel(item.proposedAmount)}
        </span>
      </div>
      {item.memo ? <p className="cs-print-item__memo">{item.memo}</p> : null}
    </article>
  )
}

function PrintPeriodSubtotal({
  markerLabel,
  currentTotal,
  proposedTotal,
}: {
  markerLabel: string
  currentTotal: number
  proposedTotal: number
}) {
  const heading = periodSubtotalLabelFromMarker(markerLabel)
  return (
    <div className="cs-print-subtotal" data-testid="coverage-period-subtotal">
      <p className="cs-print-subtotal__heading">{heading}</p>
      <div className="cs-print-subtotal__amounts">
        <span className="cs-print-subtotal__value">{formatTotalAmountLabel(currentTotal)}</span>
        <span className="cs-print-subtotal__spine" aria-hidden="true" />
        <span className="cs-print-subtotal__value cs-print-subtotal__value--proposed">
          {formatTotalAmountLabel(proposedTotal)}
        </span>
      </div>
    </div>
  )
}

function PrintTimeMarker({ label }: { label: string }) {
  return (
    <div className="cs-print-marker" data-testid="coverage-print-marker">
      <span className="cs-print-marker__line" aria-hidden="true" />
      <span className="cs-print-marker__label-mask">{label}</span>
      <span className="cs-print-marker__line" aria-hidden="true" />
    </div>
  )
}

export function CoverageSimulatorPrintDocument({ scenario }: CoverageSimulatorPrintDocumentProps) {
  const { sections, totals } = buildPrintTimelineModel(scenario)
  const customerName = resolveCustomerNameSnapshot(scenario)
  const diseaseTitle = diseaseTypeTitle(scenario.diseaseType)

  return (
    <div className="coverage-simulator-print-root" data-testid="coverage-simulator-print-root">
      <div className="cs-print-running-col-header" aria-hidden="true">
        <span className="cs-print-running-col-header__current">기존 보장</span>
        <span className="cs-print-running-col-header__axis" />
        <span className="cs-print-running-col-header__proposed">제안 보장</span>
      </div>

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

      <div className="cs-print-col-header">
        <span className="cs-print-col-header__current">기존 보장</span>
        <span className="cs-print-col-header__axis" aria-hidden="true" />
        <span className="cs-print-col-header__proposed">제안 보장</span>
      </div>

      <div className="cs-print-timeline">
        <div className="cs-print-timeline__line" aria-hidden="true" />
        <div className="cs-print-timeline__body">
          {sections.map((section) => {
            const contentBlocks = section.blocks.filter((block) => block.kind !== 'insert')
            const subtotalBlock = contentBlocks.find((block) => block.kind === 'subtotal')
            const itemBlocks = contentBlocks.filter((block) => block.kind === 'coverage')

            return (
              <div key={section.key} className="cs-print-period">
                {itemBlocks.map((block) =>
                  block.kind === 'coverage' ? <PrintCoverageItem key={block.item.id} item={block.item} /> : null,
                )}
                {subtotalBlock || section.boundaryMarker ? (
                  <div className="cs-print-period-close">
                    {subtotalBlock && subtotalBlock.kind === 'subtotal' ? (
                      <PrintPeriodSubtotal
                        markerLabel={subtotalBlock.markerLabel}
                        currentTotal={subtotalBlock.currentTotal}
                        proposedTotal={subtotalBlock.proposedTotal}
                      />
                    ) : null}
                    {section.boundaryMarker ? (
                      <PrintTimeMarker label={section.boundaryMarker.label} />
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <section className="cs-print-grand-total" data-testid="coverage-print-grand-total">
        <h2 className="cs-print-grand-total__heading">전체 총보장</h2>
        <div className="cs-print-grand-total__grid">
          <div className="cs-print-grand-total__col">
            <span className="cs-print-grand-total__label">기존 총보장</span>
            <span className="cs-print-grand-total__value">{formatTotalAmountLabel(totals.currentTotal)}</span>
          </div>
          <span className="cs-print-grand-total__spine" aria-hidden="true" />
          <div className="cs-print-grand-total__col">
            <span className="cs-print-grand-total__label">제안 총보장</span>
            <span className="cs-print-grand-total__value cs-print-grand-total__value--proposed">
              {formatTotalAmountLabel(totals.proposedTotal)}
            </span>
          </div>
        </div>
      </section>

      <footer className="cs-print-disclaimer">
        {PDF_DISCLAIMER_LINES.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <p className="cs-print-disclaimer__service">ONE FC 보장 시뮬레이션 · 상담 참고용</p>
      </footer>
    </div>
  )
}
