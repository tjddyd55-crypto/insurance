export const ADVISOR_PROFILE_THEMES = ['classic', 'brand', 'premium'] as const

export type AdvisorProfileTheme = (typeof ADVISOR_PROFILE_THEMES)[number]

export function normalizeProfileTheme(raw: unknown): AdvisorProfileTheme {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'brand' || value === 'premium') return value
  return 'classic'
}

export const ADVISOR_PROFILE_THEME_LABELS: Record<AdvisorProfileTheme, { title: string; subtitle: string }> = {
  classic: { title: '기본형', subtitle: 'Classic' },
  brand: { title: '브랜드형', subtitle: 'Brand' },
  premium: { title: '프리미엄형', subtitle: 'Premium' },
}
