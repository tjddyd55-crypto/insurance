import { normalizeConsultation, resolveCustomerNameSnapshot } from '../domain/normalizeConsultation'
import type { ConsultationCustomerFilter, CoverageScenario, DiseaseType, SavedScenarioSummary } from '../domain/types'
import {
  isPreviewUserKey,
  previewConsultationStorageKey,
  previewLegacyConsultationStorageKey,
} from './previewStorageKeys'

const CRM_STORAGE_KEY_PREFIX = 'onefc:coverage-simulator:v1'

export function crmLegacyConsultationStorageKey(userKey: string): string {
  return `${CRM_STORAGE_KEY_PREFIX}:${userKey || 'guest'}`
}

function resolveStorageKey(userKey: string): string {
  const previewKey = previewConsultationStorageKey(userKey)
  if (previewKey) return previewKey
  return crmLegacyConsultationStorageKey(userKey)
}

function migrateLegacyPreviewIfNeeded(userKey: string): void {
  if (!isPreviewUserKey(userKey)) return
  const key = previewConsultationStorageKey(userKey)!
  const legacyKey = previewLegacyConsultationStorageKey(userKey)!
  if (localStorage.getItem(key)) return
  const legacy = localStorage.getItem(legacyKey)
  if (!legacy) return
  localStorage.setItem(key, legacy)
}

export function readAllLocalConsultations(userKey: string): CoverageScenario[] {
  migrateLegacyPreviewIfNeeded(userKey)
  try {
    const raw = localStorage.getItem(resolveStorageKey(userKey))
    if (!raw) return []
    const parsed = JSON.parse(raw) as CoverageScenario[]
    return Array.isArray(parsed) ? parsed.map(normalizeConsultation) : []
  } catch {
    return []
  }
}

function writeAllLocal(userKey: string, scenarios: CoverageScenario[]): void {
  localStorage.setItem(resolveStorageKey(userKey), JSON.stringify(scenarios))
}

export function listLocalConsultations(userKey: string): SavedScenarioSummary[] {
  return readAllLocalConsultations(userKey)
    .map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      diseaseType: scenario.diseaseType,
      customerId: scenario.customerId ?? null,
      customerNameSnapshot: resolveCustomerNameSnapshot(scenario),
      customerName: resolveCustomerNameSnapshot(scenario) ?? undefined,
      consultationDate: scenario.consultationDate,
      createdAt: scenario.createdAt,
      updatedAt: scenario.updatedAt,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getLocalConsultationById(userKey: string, id: string): CoverageScenario | null {
  return readAllLocalConsultations(userKey).find((row) => row.id === id) ?? null
}

export function saveLocalConsultation(userKey: string, scenario: CoverageScenario): CoverageScenario {
  const all = readAllLocalConsultations(userKey)
  const existing = all.find((row) => row.id === scenario.id)
  const now = new Date().toISOString()
  const next = normalizeConsultation({
    ...scenario,
    kind: 'consultation',
    createdAt: existing?.createdAt ?? scenario.createdAt ?? now,
    updatedAt: now,
  })
  const index = all.findIndex((row) => row.id === next.id)
  if (index >= 0) {
    all[index] = next
  } else {
    all.unshift(next)
  }
  writeAllLocal(userKey, all)
  return next
}

export function deleteLocalConsultation(userKey: string, id: string): void {
  writeAllLocal(userKey, readAllLocalConsultations(userKey).filter((row) => row.id !== id))
}

export function renameLocalConsultation(userKey: string, id: string, title: string): CoverageScenario | null {
  const trimmed = title.trim()
  if (!trimmed) return null
  const all = readAllLocalConsultations(userKey)
  const index = all.findIndex((row) => row.id === id)
  if (index < 0) return null
  const existing = all[index]
  const now = new Date().toISOString()
  const next = normalizeConsultation({
    ...existing,
    title: trimmed,
    createdAt: existing.createdAt,
    updatedAt: now,
  })
  all[index] = next
  writeAllLocal(userKey, all)
  return next
}

export function filterConsultationsByDisease(
  summaries: SavedScenarioSummary[],
  filter: DiseaseType | 'all',
): SavedScenarioSummary[] {
  if (filter === 'all') return summaries
  return summaries.filter((row) => row.diseaseType === filter)
}

export function filterConsultationsByCustomer(
  summaries: SavedScenarioSummary[],
  filter: ConsultationCustomerFilter,
): SavedScenarioSummary[] {
  if (filter === 'all') return summaries
  if (filter === 'linked') {
    return summaries.filter((row) => Boolean(row.customerId))
  }
  return summaries.filter((row) => !row.customerId)
}
