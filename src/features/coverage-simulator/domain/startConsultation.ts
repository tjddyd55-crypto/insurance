import type { ConsultationCustomerDraft } from './customerContext'
import { createConsultationFromTemplate } from './templateOperations'
import { buildSystemTemplateSnapshot } from './systemTemplateCatalog'
import type { DiseaseType } from './types'
import type { ScenarioTemplate } from './templateTypes'
import { saveConsultation, saveConsultationAsync } from '../storage/consultationRepository'
import { isPreviewUserKey } from '../storage/previewStorageKeys'
import type { CoverageScenario } from './types'

export async function startConsultationFromUserTemplate(
  userKey: string,
  template: ScenarioTemplate,
  customer?: ConsultationCustomerDraft | null,
): Promise<CoverageScenario> {
  const consultation = createConsultationFromTemplate(template, {
    diseaseType: template.systemDiseaseType ?? 'custom',
    description: template.description ?? '',
    customer,
  })
  if (isPreviewUserKey(userKey)) {
    return saveConsultation(userKey, consultation)
  }
  return saveConsultationAsync(userKey, consultation)
}

export async function startConsultationFromSystemDisease(
  userKey: string,
  diseaseType: DiseaseType,
  customer?: ConsultationCustomerDraft | null,
): Promise<CoverageScenario | null> {
  const draft = createDraftFromSystemDisease(diseaseType, customer)
  if (!draft) return null
  if (isPreviewUserKey(userKey)) {
    return saveConsultation(userKey, draft)
  }
  return saveConsultationAsync(userKey, draft)
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
