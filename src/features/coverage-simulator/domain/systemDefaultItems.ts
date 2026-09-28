import { createScenarioId } from './ids'
import type { CoverageScenarioItem, ScenarioItem } from './types'

const MAN = 10_000

function coverage(
  partial: Omit<CoverageScenarioItem, 'id' | 'type' | 'order'> & { order: number },
): CoverageScenarioItem {
  return {
    id: createScenarioId(),
    type: 'coverage',
    ...partial,
  }
}

function marker(label: string, order: number) {
  return {
    id: createScenarioId(),
    type: 'time-marker' as const,
    label,
    order,
  }
}

export function createCancerDefaultItems(): ScenarioItem[] {
  return [
    coverage({
      category: 'diagnosis',
      label: '암 진단금',
      currentAmount: 3000 * MAN,
      proposedAmount: 5000 * MAN,
      order: 0,
    }),
    coverage({
      category: 'treatment',
      label: '암 수술비',
      currentAmount: 300 * MAN,
      proposedAmount: 1000 * MAN,
      order: 1,
    }),
    coverage({
      category: 'treatment',
      label: '항암약물치료',
      currentAmount: 500 * MAN,
      proposedAmount: 2000 * MAN,
      order: 2,
    }),
    coverage({
      category: 'treatment',
      label: '방사선치료',
      currentAmount: 300 * MAN,
      proposedAmount: 1000 * MAN,
      order: 3,
    }),
    marker('1년 후', 4),
    coverage({
      category: 'treatment',
      label: '항암약물치료',
      currentAmount: null,
      proposedAmount: 2000 * MAN,
      order: 5,
    }),
    coverage({
      category: 'treatment',
      label: '암 수술비',
      currentAmount: null,
      proposedAmount: 1000 * MAN,
      order: 6,
    }),
  ]
}

export function createCerebrovascularDefaultItems(): ScenarioItem[] {
  return [
    coverage({
      category: 'diagnosis',
      label: '뇌혈관질환 진단금',
      currentAmount: 2000 * MAN,
      proposedAmount: 5000 * MAN,
      order: 0,
    }),
    coverage({
      category: 'treatment',
      label: '뇌혈관 수술비',
      currentAmount: 500 * MAN,
      proposedAmount: 1500 * MAN,
      order: 1,
    }),
    coverage({
      category: 'treatment',
      label: '혈전용해치료비',
      currentAmount: 300 * MAN,
      proposedAmount: 800 * MAN,
      order: 2,
    }),
    coverage({
      category: 'treatment',
      label: '입원·집중치료',
      currentAmount: 200 * MAN,
      proposedAmount: 600 * MAN,
      order: 3,
    }),
    coverage({
      category: 'recovery',
      label: '재활치료',
      currentAmount: 100 * MAN,
      proposedAmount: 400 * MAN,
      order: 4,
    }),
    marker('1년 후', 5),
    coverage({
      category: 'recovery',
      label: '후속 재활·후유장해',
      currentAmount: null,
      proposedAmount: 500 * MAN,
      order: 6,
    }),
  ]
}

export function createHeartDefaultItems(): ScenarioItem[] {
  return [
    coverage({
      category: 'diagnosis',
      label: '허혈성심장질환 진단금',
      currentAmount: 2000 * MAN,
      proposedAmount: 5000 * MAN,
      order: 0,
    }),
    coverage({
      category: 'treatment',
      label: '심장질환 수술비',
      currentAmount: 800 * MAN,
      proposedAmount: 2000 * MAN,
      order: 1,
    }),
    coverage({
      category: 'treatment',
      label: '혈관중재치료',
      currentAmount: 400 * MAN,
      proposedAmount: 1200 * MAN,
      order: 2,
    }),
    coverage({
      category: 'treatment',
      label: '입원치료',
      currentAmount: 200 * MAN,
      proposedAmount: 600 * MAN,
      order: 3,
    }),
    coverage({
      category: 'recovery',
      label: '재활치료',
      currentAmount: 100 * MAN,
      proposedAmount: 400 * MAN,
      order: 4,
    }),
    marker('1년 후', 5),
    coverage({
      category: 'treatment',
      label: '후속 치료',
      currentAmount: null,
      proposedAmount: 800 * MAN,
      order: 6,
    }),
  ]
}

export function createCareDementiaDefaultItems(): ScenarioItem[] {
  return [
    coverage({
      category: 'diagnosis',
      label: '치매 진단금',
      currentAmount: 500 * MAN,
      proposedAmount: 1000 * MAN,
      order: 0,
    }),
    coverage({
      category: 'support',
      label: '장기요양 관련',
      currentAmount: 300 * MAN,
      proposedAmount: 800 * MAN,
      order: 1,
    }),
    coverage({
      category: 'support',
      label: '간병비',
      currentAmount: 200 * MAN,
      proposedAmount: 600 * MAN,
      order: 2,
    }),
    coverage({
      category: 'treatment',
      label: '입원 간병',
      currentAmount: 150 * MAN,
      proposedAmount: 400 * MAN,
      order: 3,
    }),
    coverage({
      category: 'support',
      label: '생활지원',
      currentAmount: 100 * MAN,
      proposedAmount: 300 * MAN,
      order: 4,
    }),
    marker('1년 후', 5),
    coverage({
      category: 'support',
      label: '지속 간병',
      currentAmount: null,
      proposedAmount: 600 * MAN,
      order: 6,
    }),
  ]
}

export function createFractureSurgeryDefaultItems(): ScenarioItem[] {
  return [
    coverage({
      category: 'diagnosis',
      label: '골절 진단금',
      currentAmount: 100 * MAN,
      proposedAmount: 300 * MAN,
      order: 0,
    }),
    coverage({
      category: 'treatment',
      label: '골절 수술비',
      currentAmount: 200 * MAN,
      proposedAmount: 600 * MAN,
      order: 1,
    }),
    coverage({
      category: 'treatment',
      label: '상해 수술비',
      currentAmount: 150 * MAN,
      proposedAmount: 500 * MAN,
      order: 2,
    }),
    coverage({
      category: 'treatment',
      label: '입원비',
      currentAmount: 100 * MAN,
      proposedAmount: 300 * MAN,
      order: 3,
    }),
    coverage({
      category: 'recovery',
      label: '재활치료',
      currentAmount: 80 * MAN,
      proposedAmount: 250 * MAN,
      order: 4,
    }),
    marker('1년 후', 5),
    coverage({
      category: 'recovery',
      label: '이후 치료',
      currentAmount: null,
      proposedAmount: 300 * MAN,
      order: 6,
    }),
  ]
}

export function createGenericDefaultItems(): ScenarioItem[] {
  return [
    coverage({
      category: 'diagnosis',
      label: '진단',
      currentAmount: 500 * MAN,
      proposedAmount: 1000 * MAN,
      order: 0,
    }),
    coverage({
      category: 'treatment',
      label: '치료',
      currentAmount: 300 * MAN,
      proposedAmount: 800 * MAN,
      order: 1,
    }),
    coverage({
      category: 'recovery',
      label: '회복',
      currentAmount: 100 * MAN,
      proposedAmount: 400 * MAN,
      order: 2,
    }),
    coverage({
      category: 'support',
      label: '지원',
      currentAmount: 50 * MAN,
      proposedAmount: 200 * MAN,
      order: 3,
    }),
  ]
}
