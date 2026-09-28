import { TimelineInsertControl } from '../center-timeline/TimelineInsertControl'
import { CoverageScenarioPeriodMarkerRow } from './CoverageScenarioPeriodMarkerRow'
import { CoverageScenarioSubtotalRow } from './CoverageScenarioSubtotalRow'
import { CoverageScenarioViewMode1Row } from './CoverageScenarioViewMode1Row'
import { CoverageScenarioViewMode2Row } from './CoverageScenarioViewMode2Row'
import { CoverageScenarioViewMode3Row } from './CoverageScenarioViewMode3Row'
import type { AlternativeViewRow } from '../../domain/buildAlternativeViewRows'
import type { AlternativeViewHandlers } from './alternativeViewTypes'
import type { CoverageScenarioAlternativeViewMode } from '../../domain/coverageScenarioViewMode'

type Props = AlternativeViewHandlers & {
  row: AlternativeViewRow
  viewMode: CoverageScenarioAlternativeViewMode
}

function markerMenuMode(itemMenuMode: AlternativeViewHandlers['itemMenuMode']): 'inline-delete' | 'action-sheet' {
  return itemMenuMode === 'action-sheet' ? 'action-sheet' : 'inline-delete'
}

export function AlternativeViewBlock({ row, viewMode, ...handlers }: Props) {
  if (row.kind === 'insert') {
    if (handlers.readOnly) return null
    return (
      <div className="cs-alt-insert">
        <TimelineInsertControl afterOrder={row.afterOrder} onInsert={handlers.onAddAfter} variant={row.variant} />
      </div>
    )
  }

  if (row.kind === 'subtotal') {
    return (
      <CoverageScenarioSubtotalRow
        heading={row.heading}
        currentTotal={row.currentTotal}
        proposedTotal={row.proposedTotal}
      />
    )
  }

  if (row.kind === 'marker') {
    return (
      <CoverageScenarioPeriodMarkerRow
        label={row.item.label}
        readOnly={handlers.readOnly}
        menuMode={markerMenuMode(handlers.itemMenuMode)}
        onDelete={() => handlers.onRemoveTimeMarker(row.item.id)}
      />
    )
  }

  if (viewMode === 'option2') {
    return <CoverageScenarioViewMode2Row item={row.item} displayTitle={row.displayTitle} {...handlers} />
  }

  if (viewMode === 'option3') {
    return <CoverageScenarioViewMode3Row item={row.item} displayTitle={row.displayTitle} {...handlers} />
  }

  return <CoverageScenarioViewMode1Row item={row.item} displayTitle={row.displayTitle} {...handlers} />
}
