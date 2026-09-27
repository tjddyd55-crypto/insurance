export const COVERAGE_SCENARIO_VIEW_MODES = ['default', 'option1', 'option2', 'option3'] as const

export type CoverageScenarioViewMode = (typeof COVERAGE_SCENARIO_VIEW_MODES)[number]

export type CoverageScenarioAlternativeViewMode = Exclude<CoverageScenarioViewMode, 'default'>

/** 기존 상담/시나리오 저장 키와 분리된 보기 방식 전용 prefix */
export const COVERAGE_SCENARIO_VIEW_MODE_STORAGE_PREFIX = 'coverage-simulator:view-mode'

export const COVERAGE_SCENARIO_VIEW_MODE_OPTIONS: {
  id: CoverageScenarioViewMode
  label: string
}[] = [
  { id: 'default', label: '기본형' },
  { id: 'option1', label: '안1' },
  { id: 'option2', label: '안2' },
  { id: 'option3', label: '안3' },
]

export function isCoverageScenarioViewMode(value: string | null | undefined): value is CoverageScenarioViewMode {
  return value === 'default' || value === 'option1' || value === 'option2' || value === 'option3'
}

export function parseCoverageScenarioViewMode(raw: string | null | undefined): CoverageScenarioViewMode {
  return isCoverageScenarioViewMode(raw) ? raw : 'default'
}

export function coverageScenarioViewModeStorageKey(scope: { userKey: string; layoutMode: string }): string {
  const userKey = scope.userKey.trim() || 'guest'
  const layoutMode = scope.layoutMode.trim() || 'crm'
  return `${COVERAGE_SCENARIO_VIEW_MODE_STORAGE_PREFIX}:${layoutMode}:${userKey}`
}

type ViewModeStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function readCoverageScenarioViewMode(
  storage: ViewModeStorage | null,
  key: string,
): CoverageScenarioViewMode {
  if (!storage) return 'default'
  try {
    return parseCoverageScenarioViewMode(storage.getItem(key))
  } catch {
    return 'default'
  }
}

export function writeCoverageScenarioViewMode(
  storage: ViewModeStorage | null,
  key: string,
  mode: CoverageScenarioViewMode,
): void {
  if (!storage) return
  try {
    storage.setItem(key, mode)
  } catch {
    // 저장이 막혀도 현재 화면 선택은 유지한다.
  }
}
