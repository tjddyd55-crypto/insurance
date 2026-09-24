import type { CoverageScenario } from './types'

export function normalizeConsultation(scenario: CoverageScenario): CoverageScenario {
  const snapshot = scenario.customerNameSnapshot ?? scenario.customerName ?? null

  return {
    ...scenario,
    customerId: scenario.customerId ?? null,
    customerNameSnapshot: snapshot,
    customerName: snapshot ?? undefined,
  }
}

export function resolveCustomerNameSnapshot(scenario: Pick<CoverageScenario, 'customerNameSnapshot' | 'customerName'>): string | null {
  return scenario.customerNameSnapshot ?? scenario.customerName ?? null
}
