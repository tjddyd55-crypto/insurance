import type { CoverageScenario, DiseaseType, SavedScenarioSummary } from '../domain/types'

const STORAGE_KEY_PREFIX = 'onefc:coverage-simulator:v1'

function storageKey(userKey: string): string {
  return `${STORAGE_KEY_PREFIX}:${userKey || 'guest'}`
}

function readAll(userKey: string): CoverageScenario[] {
  try {
    const raw = localStorage.getItem(storageKey(userKey))
    if (!raw) return []
    const parsed = JSON.parse(raw) as CoverageScenario[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(userKey: string, scenarios: CoverageScenario[]): void {
  localStorage.setItem(storageKey(userKey), JSON.stringify(scenarios))
}

export function listSavedScenarios(userKey: string): SavedScenarioSummary[] {
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

export function getScenarioById(userKey: string, id: string): CoverageScenario | null {
  return readAll(userKey).find((row) => row.id === id) ?? null
}

export function saveScenario(userKey: string, scenario: CoverageScenario): CoverageScenario {
  const next = {
    ...scenario,
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

export function deleteScenario(userKey: string, id: string): void {
  writeAll(userKey, readAll(userKey).filter((row) => row.id !== id))
}

export function filterSavedByDisease(
  summaries: SavedScenarioSummary[],
  filter: DiseaseType | 'all',
): SavedScenarioSummary[] {
  if (filter === 'all') return summaries
  return summaries.filter((row) => row.diseaseType === filter)
}
