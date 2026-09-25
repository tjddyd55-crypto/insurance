import type { DiseaseType } from './types'
import { SCENARIO_TYPE_CARDS } from './templates'

export function diseaseTypeTitle(diseaseType: DiseaseType): string {
  const card = SCENARIO_TYPE_CARDS.find((entry) => entry.diseaseType === diseaseType)
  return card?.title ?? diseaseType
}

export function isKnownDiseaseType(value: string): value is DiseaseType {
  return SCENARIO_TYPE_CARDS.some((entry) => entry.diseaseType === value)
}
