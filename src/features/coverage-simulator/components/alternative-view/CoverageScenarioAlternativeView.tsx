import { useMemo } from 'react'

import '../../styles/coverage-scenario-alt-view.css'
import { buildAlternativeViewRows } from '../../domain/buildAlternativeViewRows'
import type { CoverageTimelineViewModel } from '../../domain/buildCoverageTimelineViewModel'
import type { CoverageScenarioAlternativeViewMode } from '../../domain/coverageScenarioViewMode'
import { CoverageGrandTotal } from '../center-timeline/CoverageGrandTotal'
import { AlternativeViewBlock } from './AlternativeViewBlock'
import { CoverageScenarioViewMode3Grid } from './CoverageScenarioViewMode3Grid'
import type { AlternativeViewHandlers } from './alternativeViewTypes'

type Props = AlternativeViewHandlers & {
  viewMode: CoverageScenarioAlternativeViewMode
  viewModel: CoverageTimelineViewModel
  showGrandTotal: boolean
}

export function CoverageScenarioAlternativeView({
  viewMode,
  viewModel,
  showGrandTotal,
  ...handlers
}: Props) {
  const rows = useMemo(() => buildAlternativeViewRows(viewModel), [viewModel])

  return (
    <div
      className={[
        'cs-alt-view',
        `cs-alt-view--${viewMode}`,
        handlers.readOnly ? 'cs-alt-view--readonly' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="coverage-scenario-alt-view"
      data-coverage-view-mode={viewMode}
    >
      {viewMode === 'option3' ? (
        <CoverageScenarioViewMode3Grid rows={rows} {...handlers} />
      ) : (
        <div className="cs-alt-list">
          {rows.map((row) => (
            <AlternativeViewBlock key={row.key} row={row} viewMode={viewMode} {...handlers} />
          ))}
        </div>
      )}
      {showGrandTotal ? (
        <CoverageGrandTotal
          currentTotal={viewModel.totals.currentTotal}
          proposedTotal={viewModel.totals.proposedTotal}
          sticky
        />
      ) : null}
    </div>
  )
}
