import { createScenarioId } from './ids'
import {
  createCancerDefaultItems,
  createCareDementiaDefaultItems,
  createCerebrovascularDefaultItems,
  createFractureSurgeryDefaultItems,
  createGenericDefaultItems,
  createHeartDefaultItems,
} from './systemDefaultItems'
import type { CoverageScenario, DiseaseType, ScenarioItem } from './types'

export { createCancerDefaultItems } from './systemDefaultItems'

const SYSTEM_DEFAULT_META: Record<
  Exclude<DiseaseType, 'custom'>,
  { title: string; description: string; items: () => ScenarioItem[] }
> = {
  cancer: {
    title: '암 치료',
    description: '진단부터 항암·수술·방사선 치료 흐름 비교',
    items: createCancerDefaultItems,
  },
  cerebrovascular: {
    title: '뇌혈관 치료',
    description: '뇌혈관 질환 진단·수술·재활 흐름 비교',
    items: createCerebrovascularDefaultItems,
  },
  heart: {
    title: '심장질환 치료',
    description: '심장질환 진단·수술·재활 흐름 비교',
    items: createHeartDefaultItems,
  },
  'care-dementia': {
    title: '간병/치매',
    description: '치매·간병·생활지원 흐름 비교',
    items: createCareDementiaDefaultItems,
  },
  'fracture-surgery': {
    title: '골절/수술',
    description: '골절·수술·재활 흐름 비교',
    items: createFractureSurgeryDefaultItems,
  },
}

export function createScenarioFromTemplate(diseaseType: DiseaseType): CoverageScenario | null {
  const now = new Date().toISOString()
  const consultationDate = now.slice(0, 10)
  const meta =
    diseaseType === 'custom'
      ? {
          title: '기타',
          description: '일반적인 진단·치료·회복 흐름을 비교합니다.',
          items: createGenericDefaultItems(),
        }
      : SYSTEM_DEFAULT_META[diseaseType]
        ? {
            title: SYSTEM_DEFAULT_META[diseaseType].title,
            description: SYSTEM_DEFAULT_META[diseaseType].description,
            items: SYSTEM_DEFAULT_META[diseaseType].items(),
          }
        : null
  if (!meta) return null
  return {
    id: createScenarioId(),
    title: meta.title,
    diseaseType,
    description: meta.description,
    consultationDate,
    items: meta.items,
    createdAt: now,
    updatedAt: now,
  }
}

const CUSTOM_SCENARIO_CARD = {
  diseaseType: 'custom' as const,
  title: '기타',
  description: '일반적인 진단·치료·회복 흐름을 비교합니다.',
  enabled: true,
}

export const SCENARIO_TYPE_CARDS: {
  diseaseType: DiseaseType
  title: string
  description: string
  enabled: boolean
}[] = [
  ...(
    Object.entries(SYSTEM_DEFAULT_META) as [
      Exclude<DiseaseType, 'custom'>,
      (typeof SYSTEM_DEFAULT_META)[Exclude<DiseaseType, 'custom'>],
    ][]
  ).map(([diseaseType, meta]) => ({
    diseaseType,
    title: meta.title,
    description: meta.description,
    enabled: true,
  })),
  CUSTOM_SCENARIO_CARD,
]

export function diseaseTypeTitle(diseaseType: DiseaseType): string {
  return SCENARIO_TYPE_CARDS.find((card) => card.diseaseType === diseaseType)?.title ?? diseaseType
}

export function isKnownDiseaseType(value: string): value is DiseaseType {
  return SCENARIO_TYPE_CARDS.some((card) => card.diseaseType === value)
}
