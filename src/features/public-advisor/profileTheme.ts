export const ADVISOR_PROFILE_THEMES = ['classic', 'brand', 'premium'] as const

export type AdvisorProfileTheme = (typeof ADVISOR_PROFILE_THEMES)[number]

export function normalizeProfileTheme(raw: unknown): AdvisorProfileTheme {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'brand' || value === 'premium') return value
  return 'classic'
}

/** 화면 라벨. 저장 enum(classic/brand/premium) 순서는 1형·2형·3형이다. */
export const ADVISOR_PROFILE_THEME_LABELS: Record<AdvisorProfileTheme, string> = {
  classic: '1형',
  brand: '2형',
  premium: '3형',
}
