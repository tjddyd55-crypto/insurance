import type { CoverageScenario, DiseaseType, SavedScenarioSummary } from '../domain/types'

const CRM_STORAGE_KEY_PREFIX = 'onefc:coverage-simulator:v1'

/** Public web preview (로그인 없음) — CRM·사용자 키와 절대 공유하지 않는다. */
export const COVERAGE_SIMULATOR_PREVIEW_STORAGE_KEY = 'coverage-simulator-preview:v1'

/** @internal repository에서 preview 모드 판별용 */
export const COVERAGE_SIMULATOR_PREVIEW_USER_KEY = '__coverage_sim_preview__'

function storageKey(userKey: string): string {
  if (userKey === COVERAGE_SIMULATOR_PREVIEW_USER_KEY) {
    return COVERAGE_SIMULATOR_PREVIEW_STORAGE_KEY
  }
  return `${CRM_STORAGE_KEY_PREFIX}:${userKey || 'guest'}`
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
