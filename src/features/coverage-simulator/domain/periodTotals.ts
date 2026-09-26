import type { CoverageScenarioItem, ScenarioItem } from './types'

export type ScenarioPeriodTotal = {
  /** 이 구간을 닫는 time-marker id */
  endMarkerId: string
  /** null이면 시나리오 시작부터 */
  startMarkerId: string | null
  currentTotal: number
  proposedTotal: number
}

export function sumCoverageAmounts(items: CoverageScenarioItem[]): {
  currentTotal: number
  proposedTotal: number
} {
  let currentTotal = 0
  let proposedTotal = 0
  for (const item of items) {
    currentTotal += item.currentAmount ?? 0
    proposedTotal += item.proposedAmount ?? 0
  }
  return { currentTotal, proposedTotal }
}

function sortedItems(items: ScenarioItem[]): ScenarioItem[] {
  return [...items].sort((a, b) => a.order - b.order)
}

/**
 * 각 time-marker 직전 구간의 기존/제안 합계.
 * marker 자체는 합산하지 않으며, order SSOT 기준으로 구간을 나눈다.
 */
export function calculateScenarioPeriodTotals(items: ScenarioItem[]): ScenarioPeriodTotal[] {
  const periods: ScenarioPeriodTotal[] = []
  let segment: CoverageScenarioItem[] = []
  let startMarkerId: string | null = null

  for (const item of sortedItems(items)) {
    if (item.type === 'time-marker') {
      const { currentTotal, proposedTotal } = sumCoverageAmounts(segment)
      periods.push({
        endMarkerId: item.id,
        startMarkerId,
        currentTotal,
        proposedTotal,
      })
      startMarkerId = item.id
      segment = []
      continue
    }
    segment.push(item)
  }

  return periods
}

/** 마지막 marker 이후 ~ 끝 (향후 UI용). 이번 화면에서는 미표시 */
export function calculateOpenPeriodAfterLastMarker(items: ScenarioItem[]): {
  startMarkerId: string | null
  currentTotal: number
  proposedTotal: number
} {
  const sorted = sortedItems(items)
  let segment: CoverageScenarioItem[] = []
  let startMarkerId: string | null = null

  for (const item of sorted) {
    if (item.type === 'time-marker') {
      startMarkerId = item.id
      segment = []
      continue
    }
    segment.push(item)
  }

  return { startMarkerId, ...sumCoverageAmounts(segment) }
}

export function periodTotalsByEndMarkerId(
  items: ScenarioItem[],
): Map<string, ScenarioPeriodTotal> {
  return new Map(calculateScenarioPeriodTotals(items).map((row) => [row.endMarkerId, row]))
}
