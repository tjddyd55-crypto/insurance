export type DiseaseType =
  | 'cancer'
  | 'cerebrovascular'
  | 'heart'
  | 'care-dementia'
  | 'fracture-surgery'
  | 'custom'

export type ScenarioItemCategory = 'diagnosis' | 'treatment' | 'recovery' | 'support' | 'other'

export type CoverageScenarioItem = {
  id: string
  type: 'coverage'
  category: ScenarioItemCategory
  label: string
  currentAmount: number | null
  proposedAmount: number | null
  memo?: string
  order: number
  favorite?: boolean
}

export type TimeMarkerScenarioItem = {
  id: string
  type: 'time-marker'
  label: string
  order: number
}

export type ScenarioItem = CoverageScenarioItem | TimeMarkerScenarioItem

export type CoverageScenario = {
  id: string
  title: string
  diseaseType: DiseaseType
  description: string
  /** Consultation SSOT — Template에는 없음 */
  customerId?: string | null
  customerNameSnapshot?: string | null
  /** @deprecated customerNameSnapshot 사용. 하위 호환 */
  customerName?: string
  consultationDate: string
  items: ScenarioItem[]
  createdAt: string
  updatedAt: string
  /** 상담 데이터(consultation). 템플릿 편집과 분리 */
  kind?: 'consultation'
  templateId?: string
  templateNameSnapshot?: string
}

export type SavedScenarioSummary = {
  id: string
  title: string
  diseaseType: DiseaseType
  customerId?: string | null
  customerNameSnapshot?: string | null
  /** @deprecated */
  customerName?: string
  consultationDate: string
  updatedAt: string
}

export type ConsultationCustomerFilter = 'all' | 'linked' | 'unassigned'
