import type { ScenarioItemCategory } from './types'

/** Hex pairs aligned with `styles/onefc-token-bridge.css` (editor + native PDF). */
export const COVERAGE_CATEGORY_THEME: Record<ScenarioItemCategory, { bg: string; fg: string }> = {
  diagnosis: { bg: '#fff1f2', fg: '#e11d48' },
  treatment: { bg: '#fff7ed', fg: '#ea580c' },
  recovery: { bg: '#dcfce7', fg: '#16a34a' },
  support: { bg: '#f5f3ff', fg: '#7c3aed' },
  other: { bg: '#f1f5f9', fg: '#6b7280' },
}

export function getCoverageCategoryTheme(category: ScenarioItemCategory): { bg: string; fg: string } {
  return COVERAGE_CATEGORY_THEME[category]
}

/** Modifier class for `CoverageBadge` — colors live in `styles/categoryBadgeTheme.css`. */
export function coverageCategoryBadgeClass(category: ScenarioItemCategory): string {
  return `coverage-simulator-badge--${category}`
}

export const COVERAGE_CATEGORY_BADGE_MODIFIERS: Record<ScenarioItemCategory, string> = {
  diagnosis: coverageCategoryBadgeClass('diagnosis'),
  treatment: coverageCategoryBadgeClass('treatment'),
  recovery: coverageCategoryBadgeClass('recovery'),
  support: coverageCategoryBadgeClass('support'),
  other: coverageCategoryBadgeClass('other'),
}
