import { shouldShowTimelineInsertAfterItem } from './timelineInsertVisibility'
import { sortedScenarioItems } from './timelinePeriodBounds'
import type { CoverageScenarioItem, ScenarioItem } from './types'

export type TimelineRenderBlock =
  | { kind: 'coverage'; item: CoverageScenarioItem }
  | { kind: 'insert'; afterOrder: number; variant: 'default' | 'marker-tail' }
  | {
      kind: 'subtotal'
      markerId: string
      markerLabel: string
      currentTotal: number
      proposedTotal: number
    }

export type TimelinePeriodSectionRender = {
  key: string
  tintIndex: number
  blocks: TimelineRenderBlock[]
  boundaryMarker: Extract<ScenarioItem, { type: 'time-marker' }> | null
}

type PeriodTotalsMap = Map<string, { currentTotal: number; proposedTotal: number }>

export function buildTimelinePeriodSections(
  items: ScenarioItem[],
  compactInsert: boolean,
  periodByMarkerId: PeriodTotalsMap,
): TimelinePeriodSectionRender[] {
  if (!compactInsert) {
    return []
  }

  const sorted = sortedScenarioItems(items)
  if (sorted.length === 0) {
    return [
      {
        key: 'period-0',
        tintIndex: 0,
        blocks: [{ kind: 'insert', afterOrder: -1, variant: 'default' }],
        boundaryMarker: null,
      },
    ]
  }

  const sections: TimelinePeriodSectionRender[] = []
  let blocks: TimelineRenderBlock[] = []
  let tintIndex = 0

  const flushOpenSection = () => {
    if (blocks.length === 0) return
    sections.push({
      key: `period-${sections.length}`,
      tintIndex,
      blocks: [...blocks],
      boundaryMarker: null,
    })
    tintIndex += 1
    blocks = []
  }

  for (const item of sorted) {
    if (item.type === 'coverage') {
      blocks.push({ kind: 'coverage', item })
      if (shouldShowTimelineInsertAfterItem(item, items, true)) {
        blocks.push({ kind: 'insert', afterOrder: item.order, variant: 'default' })
      }
      continue
    }

    const totals = periodByMarkerId.get(item.id)
    if (totals) {
      blocks.push({
        kind: 'subtotal',
        markerId: item.id,
        markerLabel: item.label,
        currentTotal: totals.currentTotal,
        proposedTotal: totals.proposedTotal,
      })
    }

    sections.push({
      key: `period-${sections.length}`,
      tintIndex,
      blocks: [...blocks],
      boundaryMarker: item,
    })
    tintIndex += 1
    blocks = []

    if (shouldShowTimelineInsertAfterItem(item, items, true)) {
      blocks.push({ kind: 'insert', afterOrder: item.order, variant: 'marker-tail' })
    }
  }

  flushOpenSection()
  return sections
}
