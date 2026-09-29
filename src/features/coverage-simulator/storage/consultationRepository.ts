import { normalizeConsultation, resolveCustomerNameSnapshot } from '../domain/normalizeConsultation'
import type { ConsultationCustomerFilter, CoverageScenario, DiseaseType, SavedScenarioSummary } from '../domain/types'
import { isPreviewUserKey } from './previewStorageKeys'
import {
  deleteLocalConsultation,
  filterConsultationsByCustomer,
  filterConsultationsByDisease,
  getLocalConsultationById,
  listLocalConsultations,
  renameLocalConsultation,
  saveLocalConsultation,
} from './localConsultationRepository'
import {
  deleteCrmConsultation,
  getCrmConsultationById,
  isCrmCoverageStorageReady,
  listCrmConsultations,
  saveCrmConsultation,
} from './crmCoverageStorageSession'

export function listConsultations(userKey: string): SavedScenarioSummary[] {
  const rows = isPreviewUserKey(userKey)
    ? listLocalConsultations(userKey)
    : isCrmCoverageStorageReady(userKey)
      ? listCrmConsultations().map((scenario) => ({
          id: scenario.id,
          title: scenario.title,
          diseaseType: scenario.diseaseType,
          templateId: scenario.templateId,
          templateNameSnapshot: scenario.templateNameSnapshot,
          customerId: scenario.customerId ?? null,
          customerNameSnapshot: resolveCustomerNameSnapshot(scenario),
          customerName: resolveCustomerNameSnapshot(scenario) ?? undefined,
          consultationDate: scenario.consultationDate,
          createdAt: scenario.createdAt,
          updatedAt: scenario.updatedAt,
        }))
      : []
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function listConsultationsByDisease(
  userKey: string,
  diseaseType: DiseaseType,
  customerId?: string | null,
): SavedScenarioSummary[] {
  return listConsultations(userKey).filter((row) => {
    if (row.diseaseType !== diseaseType) return false
    if (customerId) return row.customerId === customerId
    return true
  })
}

export function listConsultationsByTemplateId(
  userKey: string,
  templateId: string,
  customerId?: string | null,
): SavedScenarioSummary[] {
  return listConsultations(userKey).filter((row) => {
    if (row.templateId !== templateId) return false
    if (customerId) return row.customerId === customerId
    return true
  })
}

export function getConsultationById(userKey: string, id: string): CoverageScenario | null {
  if (isPreviewUserKey(userKey)) {
    return getLocalConsultationById(userKey, id)
  }
  if (!isCrmCoverageStorageReady(userKey)) return null
  const found = getCrmConsultationById(id)
  return found ? normalizeConsultation(found) : null
}

export function saveConsultation(userKey: string, scenario: CoverageScenario): CoverageScenario {
  if (isPreviewUserKey(userKey)) {
    return saveLocalConsultation(userKey, scenario)
  }
  throw new Error('CRM 시뮬레이션 저장은 saveConsultationAsync를 사용하세요.')
}

export async function saveConsultationAsync(
  userKey: string,
  scenario: CoverageScenario,
): Promise<CoverageScenario> {
  if (isPreviewUserKey(userKey)) {
    return saveLocalConsultation(userKey, scenario)
  }
  const saved = await saveCrmConsultation(normalizeConsultation(scenario))
  return normalizeConsultation(saved)
}

export function deleteConsultation(userKey: string, id: string): void {
  if (isPreviewUserKey(userKey)) {
    deleteLocalConsultation(userKey, id)
    return
  }
  throw new Error('CRM 시뮬레이션 삭제는 deleteConsultationAsync를 사용하세요.')
}

export async function deleteConsultationAsync(userKey: string, id: string): Promise<void> {
  if (isPreviewUserKey(userKey)) {
    deleteLocalConsultation(userKey, id)
    return
  }
  await deleteCrmConsultation(id)
}

export function renameConsultation(userKey: string, id: string, title: string): CoverageScenario | null {
  if (isPreviewUserKey(userKey)) {
    return renameLocalConsultation(userKey, id, title)
  }
  throw new Error('CRM 제목 변경은 renameConsultationAsync를 사용하세요.')
}

export async function renameConsultationAsync(
  userKey: string,
  id: string,
  title: string,
): Promise<CoverageScenario | null> {
  const trimmed = title.trim()
  if (!trimmed) return null
  const current = getConsultationById(userKey, id)
  if (!current) return null
  return saveConsultationAsync(userKey, { ...current, title: trimmed })
}

export { filterConsultationsByDisease, filterConsultationsByCustomer }
