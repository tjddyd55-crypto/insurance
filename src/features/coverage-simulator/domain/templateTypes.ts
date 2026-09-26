import type { DiseaseType, ScenarioItem, ScenarioItemCategory } from './types'

export type TemplateSourceType = 'system' | 'user'

export type ScenarioTemplate = {
  id: string
  name: string
  description?: string
  sourceType: TemplateSourceType
  /** system 템플릿일 때 diseaseType SSOT */
  systemDiseaseType?: DiseaseType
  category?: ScenarioItemCategory
  items: ScenarioItem[]
  createdAt: string
  updatedAt: string
}

export type ScenarioTemplateSummary = {
  id: string
  name: string
  description?: string
  sourceType: TemplateSourceType
  itemCount: number
  updatedAt: string
}
