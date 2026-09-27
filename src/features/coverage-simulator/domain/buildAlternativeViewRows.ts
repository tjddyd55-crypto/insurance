import type { CoverageTimelineViewModel } from './buildCoverageTimelineViewModel'
import { periodSubtotalLabelFromMarker } from './periodSubtotalLabel'
import {
  buildTimelinePeriodSections,
  type TimelinePeriodSectionRender,
} from './timelinePeriodSections'
import type { CoverageScenarioItem, TimeMarkerScenarioItem } from './types'

export type AlternativeViewRow =
  | { kind: 'coverage'; key: string; item: CoverageScenarioItem; displayTitle: string }
  | { kind: 'insert'; key: string; afterOrder: number; variant: 'default' | 'marker-tail' }
  | {
      kind: 'subtotal'
      key: string
      markerId: string
      markerLabel: string
      heading: string
      currentTotal: number
      proposedTotal: number
    }
  | { kind: 'marker'; key: string; item: TimeMarkerScenarioItem }

function flattenSections(
  sections: TimelinePeriodSectionRender[],
  displayTitleByItemId: ReadonlyMap<string, string>,
): AlternativeViewRow[] {
  const rows: AlternativeViewRow[] = []
  for (const section of sections) {
    section.blocks.forEach((block, index) => {
      if (block.kind === 'coverage') {
        rows.push({
          kind: 'coverage',
          key: block.item.id,
          item: block.item,
          displayTitle: displayTitleByItemId.get(block.item.id) ?? block.item.label,
        })
        return
      }
      if (block.kind === 'insert') {
        rows.push({
          kind: 'insert',
          key: `${section.key}-insert-${index}`,
          afterOrder: block.afterOrder,
          variant: block.variant,
        })
        return
      }
      rows.push({
        kind: 'subtotal',
        key: `${section.key}-subtotal-${block.markerId}`,
        markerId: block.markerId,
        markerLabel: block.markerLabel,
        heading: periodSubtotalLabelFromMarker(block.markerLabel),
        currentTotal: block.currentTotal,
        proposedTotal: block.proposedTotal,
      })
    })
    if (section.boundaryMarker) {
      rows.push({
        kind: 'marker',
        key: section.boundaryMarker.id,
        item: section.boundaryMarker,
      })
    }
  }
  return rows
}

/** 대안 보기는 기간 구간 SSOT를 그대로 펼친다. 합계는 다시 계산하지 않는다. */
export function buildAlternativeViewRows(viewModel: CoverageTimelineViewModel): AlternativeViewRow[] {
  const sections = buildTimelinePeriodSections(viewModel.sortedItems, true, viewModel.periodByMarkerId)
  return flattenSections(sections, viewModel.displayTitleByItemId)
}
