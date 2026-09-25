import type { ConsultationCustomerDraft } from './customerContext'
import { createConsultationFromTemplate } from './templateOperations'
import { buildSystemTemplateSnapshot } from './systemTemplateCatalog'
import type { DiseaseType } from './types'
import type { ScenarioTemplate } from './templateTypes'
import { saveConsultation } from '../storage/consultationRepository'
import type { CoverageScenario } from './types'

export function startConsultationFromUserTemplate(
  userKey: string,
  template: ScenarioTemplate,
  customer?: ConsultationCustomerDraft | null,
): CoverageScenario {
  const consultation = createConsultationFromTemplate(template, {
    diseaseType: 'custom',
    customer,
  })
  return saveConsultation(userKey, consultation)
}

export function startConsultationFromSystemDisease(
  userKey: string,
  diseaseType: DiseaseType,
  customer?: ConsultationCustomerDraft | null,
): CoverageScenario | null {
  const draft = createDraftFromSystemDisease(diseaseType, customer)
  if (!draft) return null
  return saveConsultation(userKey, draft)
}

/** localStorage에 쓰지 않는 신규 편집 draft */
export function createDraftFromSystemDisease(
  diseaseType: DiseaseType,
  customer?: ConsultationCustomerDraft | null,
): CoverageScenario | null {
  const system = buildSystemTemplateSnapshot(diseaseType)
  if (!system) return null
  return createConsultationFromTemplate(system, {
    diseaseType,
    description: system.description ?? '',
    customer,
  })
}
