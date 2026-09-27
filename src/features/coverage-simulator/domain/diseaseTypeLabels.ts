import type { DiseaseType } from './types'
import { SCENARIO_TYPE_CARDS } from './templates'

export function diseaseTypeTitle(diseaseType: DiseaseType): string {
  const card = SCENARIO_TYPE_CARDS.find((entry) => entry.diseaseType === diseaseType)
  return card?.title ?? diseaseType
}

/** 문서 헤더 둘째 줄. 병명과 시나리오 제목을 한 줄로 둔다. */
export function formatCoverageScenarioHeading(diseaseType: DiseaseType, title: string | undefined): string {
  const diseaseTitle = diseaseTypeTitle(diseaseType)
  const trimmed = title?.trim() ?? ''
  if (!trimmed) return diseaseTitle
  return `${diseaseTitle} — ${trimmed}`
}

export function isKnownDiseaseType(value: string): value is DiseaseType {
  return SCENARIO_TYPE_CARDS.some((entry) => entry.diseaseType === value)
}
