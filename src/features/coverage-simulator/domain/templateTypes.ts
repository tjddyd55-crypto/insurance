import type { DiseaseType, ScenarioItem, ScenarioItemCategory } from './types'

export type TemplateSourceType = 'system' | 'user'

export type ScenarioTemplate = {
  id: string
  /** 브라우저 로컬 id. 서버 행은 숫자 id 와 이 값을 함께 가진다. */
  legacyClientId?: string | null
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
