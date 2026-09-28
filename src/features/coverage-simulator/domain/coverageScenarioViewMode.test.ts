import { describe, expect, it } from 'vitest'

import {
  COVERAGE_SCENARIO_VIEW_MODE_OPTIONS,
  coverageScenarioViewModeStorageKey,
  parseCoverageScenarioViewMode,
  readCoverageScenarioViewMode,
  writeCoverageScenarioViewMode,
} from './coverageScenarioViewMode'

describe('coverageScenarioViewMode', () => {
  it('defaults to the current card view', () => {
    expect(parseCoverageScenarioViewMode(null)).toBe('default')
    expect(parseCoverageScenarioViewMode('')).toBe('default')
    expect(parseCoverageScenarioViewMode('cards')).toBe('default')
  })

  it('keeps the four labeled modes', () => {
    expect(COVERAGE_SCENARIO_VIEW_MODE_OPTIONS.map((option) => option.label)).toEqual([
      '기본',
      '1안',
      '2안',
      '3안',
    ])
    expect(parseCoverageScenarioViewMode('option1')).toBe('option1')
    expect(parseCoverageScenarioViewMode('option2')).toBe('option2')
    expect(parseCoverageScenarioViewMode('option3')).toBe('option3')
  })

  it('stores the choice on an independent key scoped by layout and user', () => {
    const key = coverageScenarioViewModeStorageKey({
      userKey: 'user-1',
      layoutMode: 'preview-mobile',
    })
    expect(key).toBe('coverage-simulator:view-mode:preview-mobile:user-1')
    expect(key.startsWith('onefc:coverage-simulator:')).toBe(false)

    const saved = new Map<string, string>()
    const storage = {
      getItem: (name: string) => saved.get(name) ?? null,
      setItem: (name: string, value: string) => {
        saved.set(name, value)
      },
    }
    writeCoverageScenarioViewMode(storage, key, 'option2')
    expect(readCoverageScenarioViewMode(storage, key)).toBe('option2')
    expect(readCoverageScenarioViewMode(storage, 'other')).toBe('default')
  })
})
