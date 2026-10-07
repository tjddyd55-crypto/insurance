import { describe, expect, it } from 'vitest'

import {
  COVERAGE_CATEGORY_BADGE_MODIFIERS,
  COVERAGE_CATEGORY_THEME,
  coverageCategoryBadgeClass,
  getCoverageCategoryTheme,
} from './categoryBadgeTheme'

describe('categoryBadgeTheme', () => {
  it('maps categories to shared badge modifier classes', () => {
    expect(coverageCategoryBadgeClass('diagnosis')).toBe('coverage-simulator-badge--diagnosis')
    expect(COVERAGE_CATEGORY_BADGE_MODIFIERS.treatment).toBe('coverage-simulator-badge--treatment')
  })

  it('exposes shared hex theme for non-CSS surfaces', () => {
    expect(getCoverageCategoryTheme('diagnosis')).toEqual(COVERAGE_CATEGORY_THEME.diagnosis)
  })
})
