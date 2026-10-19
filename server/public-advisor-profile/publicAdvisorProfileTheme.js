export const ADVISOR_PROFILE_THEME_VALUES = ['classic', 'brand', 'premium']

const ALLOWED = new Set(ADVISOR_PROFILE_THEME_VALUES)

/** @param {unknown} raw */
export function normalizeAdvisorProfileTheme(raw) {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (!value || !ALLOWED.has(value)) return 'classic'
  return value
}
