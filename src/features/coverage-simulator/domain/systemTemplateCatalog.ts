import type { DiseaseType } from './types'
import type { ScenarioTemplate } from './templateTypes'
import { createScenarioFromTemplate, SCENARIO_TYPE_CARDS } from './templates'

export type SystemTemplateCard = {
  diseaseType: DiseaseType
  title: string
  description: string
  enabled: boolean
}

export const SYSTEM_TEMPLATE_CARDS: SystemTemplateCard[] = SCENARIO_TYPE_CARDS.map((card) => ({
  diseaseType: card.diseaseType,
  title: card.title.replace(/ 시나리오$/, ''),
  description: card.description,
  enabled: card.enabled,
}))

export function getSystemTemplateMeta(diseaseType: DiseaseType): SystemTemplateCard | undefined {
  return SYSTEM_TEMPLATE_CARDS.find((card) => card.diseaseType === diseaseType)
}

/** 시스템 템플릿 원본(코드 SSOT). localStorage에 저장하지 않음 */
export function buildSystemTemplateSnapshot(diseaseType: DiseaseType): ScenarioTemplate | null {
  const scenario = createScenarioFromTemplate(diseaseType)
  const meta = getSystemTemplateMeta(diseaseType)
  if (!scenario || !meta) return null
  return {
    id: `system:${diseaseType}`,
    name: meta.title,
    description: scenario.description,
    sourceType: 'system',
    systemDiseaseType: diseaseType,
    items: scenario.items,
    createdAt: scenario.createdAt,
    updatedAt: scenario.updatedAt,
  }
}

export function listSystemTemplateSummaries(): {
  id: string
  diseaseType: DiseaseType
  name: string
  description: string
  enabled: boolean
  itemCount: number
}[] {
  return SYSTEM_TEMPLATE_CARDS.map((card) => {
    const snapshot = buildSystemTemplateSnapshot(card.diseaseType)
    return {
      id: `system:${card.diseaseType}`,
      diseaseType: card.diseaseType,
      name: card.title,
      description: card.description,
      enabled: card.enabled,
      itemCount: snapshot?.items.length ?? 0,
    }
  })
}
