import { buildTimelinePeriodSections } from '../domain/timelinePeriodSections'
import { periodTotalsByEndMarkerId } from '../domain/periodTotals'
import { calculateScenarioTotals } from '../domain/totals'
import type { CoverageScenario } from '../domain/types'

/** PDF / Print — same section blocks as mobile timeline (compactInsert), no insert controls. */
export function buildPrintTimelineModel(scenario: CoverageScenario) {
  const items = scenario.items
  const periodByMarkerId = periodTotalsByEndMarkerId(items)
  const sections = buildTimelinePeriodSections(items, true, periodByMarkerId)
  const totals = calculateScenarioTotals(scenario)
  return { sections, totals, items }
}
