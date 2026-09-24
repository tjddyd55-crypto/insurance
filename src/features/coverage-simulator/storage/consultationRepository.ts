import type { CoverageScenario, DiseaseType, SavedScenarioSummary } from '../domain/types'
import {
  isPreviewUserKey,
  previewConsultationStorageKey,
  previewLegacyConsultationStorageKey,
} from './previewStorageKeys'

const CRM_STORAGE_KEY_PREFIX = 'onefc:coverage-simulator:v1'

function crmStorageKey(userKey: string): string {
  return `${CRM_STORAGE_KEY_PREFIX}:${userKey || 'guest'}`
}

function resolveStorageKey(userKey: string): string {
  const previewKey = previewConsultationStorageKey(userKey)
  if (previewKey) return previewKey
  return crmStorageKey(userKey)
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

function readAll(userKey: string): CoverageScenario[] {
  migrateLegacyPreviewIfNeeded(userKey)
  try {
    const raw = localStorage.getItem(resolveStorageKey(userKey))
    if (!raw) return []
    const parsed = JSON.parse(raw) as CoverageScenario[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(userKey: string, scenarios: CoverageScenario[]): void {
  localStorage.setItem(resolveStorageKey(userKey), JSON.stringify(scenarios))
}

export function listConsultations(userKey: string): SavedScenarioSummary[] {
  return readAll(userKey)
    .map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      diseaseType: scenario.diseaseType,
      customerName: scenario.customerName,
      consultationDate: scenario.consultationDate,
      updatedAt: scenario.updatedAt,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getConsultationById(userKey: string, id: string): CoverageScenario | null {
  return readAll(userKey).find((row) => row.id === id) ?? null
}

export function saveConsultation(userKey: string, scenario: CoverageScenario): CoverageScenario {
  const next: CoverageScenario = {
    ...scenario,
    kind: 'consultation',
    updatedAt: new Date().toISOString(),
  }
  const all = readAll(userKey)
  const index = all.findIndex((row) => row.id === next.id)
  if (index >= 0) {
    all[index] = next
  } else {
    all.unshift(next)
  }
  writeAll(userKey, all)
  return next
}

export function deleteConsultation(userKey: string, id: string): void {
  writeAll(userKey, readAll(userKey).filter((row) => row.id !== id))
}

export function filterConsultationsByDisease(
  summaries: SavedScenarioSummary[],
  filter: DiseaseType | 'all',
): SavedScenarioSummary[] {
  if (filter === 'all') return summaries
  return summaries.filter((row) => row.diseaseType === filter)
}
