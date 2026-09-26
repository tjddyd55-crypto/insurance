import type { CoverageScenario } from './types'

/** 저장 여부 비교용 — id/타임스탬프 제외 */
export function consultationContentSnapshot(scenario: CoverageScenario): string {
  return JSON.stringify({
    title: scenario.title,
    diseaseType: scenario.diseaseType,
    description: scenario.description,
    customerId: scenario.customerId ?? null,
    customerNameSnapshot: scenario.customerNameSnapshot ?? null,
    consultationDate: scenario.consultationDate,
    items: scenario.items,
  })
}
