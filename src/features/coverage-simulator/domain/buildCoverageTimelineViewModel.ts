import { resolveCoverageDisplayTitle } from './coverageDisplayTitle'
import { periodTotalsByEndMarkerId } from './periodTotals'
import {
  buildTimelinePeriodSections,
  type TimelinePeriodSectionRender,
} from './timelinePeriodSections'
import { sortedScenarioItems } from './timelinePeriodBounds'
import { calculateScenarioTotals } from './totals'
import type { CoverageScenario, CoverageScenarioItem, ScenarioItem } from './types'

export type CoverageTimelineViewModel = {
  items: ScenarioItem[]
  sortedItems: ScenarioItem[]
  displayTitleByItemId: ReadonlyMap<string, string>
  periodByMarkerId: Map<string, { currentTotal: number; proposedTotal: number }>
  sections: TimelinePeriodSectionRender[]
  totals: { currentTotal: number; proposedTotal: number }
}

export type BuildCoverageTimelineViewModelOptions = {
  /** Mobile preview / share / print — period sections with compact insert slots */
  compactInsert?: boolean
}

export function buildCoverageTimelineViewModel(
  scenario: Pick<CoverageScenario, 'items'> & Partial<CoverageScenario>,
  options: BuildCoverageTimelineViewModelOptions = {},
): CoverageTimelineViewModel {
  const compactInsert = options.compactInsert ?? true
  const items = scenario.items
  const sortedItems = sortedScenarioItems(items)
  const displayTitleByItemId = new Map<string, string>()

  for (const item of sortedItems) {
    if (item.type === 'coverage') {
      displayTitleByItemId.set(item.id, resolveCoverageDisplayTitle(item))
    }
  }

  const periodByMarkerId = periodTotalsByEndMarkerId(items)
  const sections = buildTimelinePeriodSections(items, compactInsert, periodByMarkerId)
  const totals = calculateScenarioTotals({
    ...scenario,
    items,
    id: scenario.id ?? 'view-model',
    title: scenario.title ?? '',
    diseaseType: scenario.diseaseType ?? 'cancer',
    description: scenario.description ?? '',
    consultationDate: scenario.consultationDate ?? '',
    createdAt: scenario.createdAt ?? '',
    updatedAt: scenario.updatedAt ?? '',
  })

  return {
    items,
    sortedItems,
    displayTitleByItemId,
    periodByMarkerId,
    sections,
    totals,
  }
}

export function coverageTimelineConsistencySnapshot(viewModel: CoverageTimelineViewModel) {
  const coverageRows = viewModel.sortedItems
    .filter((item): item is CoverageScenarioItem => item.type === 'coverage')
    .map((item) => ({
      id: item.id,
      order: item.order,
      displayTitle: viewModel.displayTitleByItemId.get(item.id) ?? '',
      category: item.category,
      currentAmountLabel: item.currentAmount,
      proposedAmountLabel: item.proposedAmount,
    }))

  const markers = viewModel.sortedItems
    .filter((item) => item.type === 'time-marker')
    .map((item) => ({ id: item.id, order: item.order, label: item.label }))

  const subtotals = viewModel.sections.flatMap((section) =>
    section.blocks
      .filter((block) => block.kind === 'subtotal')
      .map((block) =>
        block.kind === 'subtotal'
          ? {
              markerLabel: block.markerLabel,
              currentTotal: block.currentTotal,
              proposedTotal: block.proposedTotal,
            }
          : null,
      )
      .filter(Boolean),
  )

  return {
    itemCount: coverageRows.length,
    coverageRows,
    markers,
    subtotals,
    grandTotal: viewModel.totals,
  }
}
