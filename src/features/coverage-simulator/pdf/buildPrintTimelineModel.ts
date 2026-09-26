import { buildCoverageTimelineViewModel } from '../domain/buildCoverageTimelineViewModel'
import type { CoverageScenario } from '../domain/types'

/** @deprecated buildCoverageTimelineViewModel 사용 — PDF/Print/Viewer SSOT */
export function buildPrintTimelineModel(scenario: CoverageScenario) {
  const viewModel = buildCoverageTimelineViewModel(scenario, { compactInsert: true })
  return {
    sections: viewModel.sections,
    totals: viewModel.totals,
    items: viewModel.items,
  }
}
