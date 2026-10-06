import type { DiseaseType, ScenarioItem, ScenarioItemCategory } from './types'

export type TemplateSourceType = 'system' | 'user'

export type ScenarioTemplate = {
  id: string
  name: string
  description?: string
  sourceType: TemplateSourceType
  /** Legacy / origin metadata — not used for CRUD restrictions */
  systemDiseaseType?: DiseaseType
  /** Initial seed identity when created from bootstrap */
  seedKey?: string
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
  seedKey?: string
  itemCount: number
  updatedAt: string
}
