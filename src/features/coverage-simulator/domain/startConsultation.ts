import type { ConsultationCustomerDraft } from './customerContext'
import { emptyCustomerDraft } from './customerContext'
import { createScenarioId } from './ids'
import { seoulTodayYmd } from './formatConsultationDate'
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

/** 템플릿 없이 바로 만드는 시뮬레이션. templateId 는 두지 않는다. */
export function createEmptyConsultationDraft(
  customer?: ConsultationCustomerDraft | null,
  title = '새 시뮬레이션',
): CoverageScenario {
  const now = new Date().toISOString()
  const draft = customer ?? emptyCustomerDraft()
  const snapshot = draft.customerNameSnapshot
  return {
    id: createScenarioId(),
    kind: 'consultation',
    title: title.trim() || '새 시뮬레이션',
    diseaseType: 'custom',
    description: '',
    customerId: draft.customerId,
    customerNameSnapshot: snapshot,
    customerName: snapshot ?? undefined,
    consultationDate: seoulTodayYmd(),
    items: [],
    createdAt: now,
    updatedAt: now,
  }
}

export async function startDirectConsultation(
  userKey: string,
  title: string,
  customer?: ConsultationCustomerDraft | null,
): Promise<CoverageScenario> {
  const draft = createEmptyConsultationDraft(customer, title)
  if (isPreviewUserKey(userKey)) {
    return saveConsultation(userKey, draft)
  }
  return saveConsultationAsync(userKey, draft)
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
