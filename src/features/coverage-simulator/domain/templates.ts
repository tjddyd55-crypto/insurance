import { createScenarioId } from './ids'
import type { CoverageScenario, CoverageScenarioItem, DiseaseType, ScenarioItem } from './types'

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

export function createScenarioFromTemplate(diseaseType: DiseaseType): CoverageScenario | null {
  const now = new Date().toISOString()
  const consultationDate = new Date().toISOString().slice(0, 10)
  if (diseaseType === 'cancer') {
    return {
      id: createScenarioId(),
      title: '암 치료',
      diseaseType,
      description: '일반적인 암 치료 과정을 기준으로 현재 보장과 제안 보장을 비교합니다.',
      consultationDate,
      items: createCancerDefaultItems(),
      createdAt: now,
      updatedAt: now,
    }
  }
  return null
}

export const SCENARIO_TYPE_CARDS: {
  diseaseType: DiseaseType
  title: string
  description: string
  enabled: boolean
}[] = [
  {
    diseaseType: 'cancer',
    title: '암 치료',
    description: '진단부터 항암·수술·방사선 치료 흐름 비교',
    enabled: true,
  },
  {
    diseaseType: 'cerebrovascular',
    title: '뇌혈관 치료 시나리오',
    description: '준비 중',
    enabled: false,
  },
  {
    diseaseType: 'heart',
    title: '심장질환 치료 시나리오',
    description: '준비 중',
    enabled: false,
  },
  {
    diseaseType: 'care-dementia',
    title: '간병/치매 시나리오',
    description: '준비 중',
    enabled: false,
  },
  {
    diseaseType: 'fracture-surgery',
    title: '골절/수술 시나리오',
    description: '준비 중',
    enabled: false,
  },
  {
    diseaseType: 'custom',
    title: '기타 시나리오',
    description: '준비 중',
    enabled: false,
  },
]
