export const ADVISOR_OG_HEADLINE_FALLBACK =
  'ONE FC 모바일 명함에서 프로필과 상담 정보를 확인해보세요.'

export const ADVISOR_OG_IMAGE_WIDTH = 1200
export const ADVISOR_OG_IMAGE_HEIGHT = 630

/**
 * @param {{ gaName?: string | null, teamName?: string | null, headline?: string | null }} input
 */
export function buildAdvisorOgDescription(input) {
  const affiliation = [String(input.gaName ?? '').trim(), String(input.teamName ?? '').trim()]
    .filter(Boolean)
    .join(' · ')
  const headline = String(input.headline ?? '').trim() || ADVISOR_OG_HEADLINE_FALLBACK
  const description = affiliation ? `${affiliation} · ${headline}` : headline
  return description.slice(0, 200)
}

/**
 * @param {{ displayName?: string | null, titleLabel?: string | null }} input
 */
export function buildAdvisorOgTitle(input) {
  const name = String(input.displayName ?? '').trim() || '설계사'
  const suffix = String(input.titleLabel ?? '').trim() || 'FC'
  return `${name} ${suffix} | ONE FC`
}

export function buildAdvisorOgCardApiPath(slug) {
  const s = String(slug ?? '').trim()
  return `/api/public/advisors/${encodeURIComponent(s)}/og-card.png`
}
