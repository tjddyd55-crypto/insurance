export type AdvisorHeroDisplayInput = {
  /** null/undefined = 저장값 없음 → fallback, '' = 사용자가 비움 → 비노출 */
  heroDisplayEyebrow?: string | null
  heroDisplayTitle?: string | null
  heroDisplaySubtitle?: string | null
  displayName: string
  titleLabel?: string | null
  gaName?: string | null
  teamName?: string | null
  primaryBadgeLabel?: string | null
}

export type ResolvedAdvisorHeroDisplay = {
  heroEyebrowLine: string | null
  heroTitleLine: string | null
  heroSubtitleLine: string | null
  primaryBadgeLabel: string | null
}

function isUnset(value: string | null | undefined): boolean {
  return value === null || value === undefined
}

function resolveTitleSuffix(titleLabel: string | null | undefined): string {
  if (isUnset(titleLabel)) return 'FC'
  return String(titleLabel).trim()
}

export function resolveAdvisorHeroDisplay(input: AdvisorHeroDisplayInput): ResolvedAdvisorHeroDisplay {
  const displayName = String(input.displayName ?? '').trim()
  const titleSuffix = resolveTitleSuffix(input.titleLabel)
  const autoTitle = [displayName, titleSuffix].filter(Boolean).join(' ').trim() || 'ONE FC'
  const autoSubtitle = [input.gaName, input.teamName].filter(Boolean).join(' · ').trim()

  let heroTitleLine: string | null
  if (isUnset(input.heroDisplayTitle)) {
    heroTitleLine = autoTitle
  } else if (input.heroDisplayTitle === '') {
    heroTitleLine = null
  } else {
    heroTitleLine = String(input.heroDisplayTitle).trim() || null
  }

  let heroSubtitleLine: string | null
  if (isUnset(input.heroDisplaySubtitle)) {
    heroSubtitleLine = autoSubtitle || null
  } else if (input.heroDisplaySubtitle === '') {
    heroSubtitleLine = null
  } else {
    heroSubtitleLine = String(input.heroDisplaySubtitle).trim() || null
  }

  let heroEyebrowLine: string | null
  let primaryBadgeLabel: string | null = String(input.primaryBadgeLabel ?? '').trim() || null

  if (isUnset(input.heroDisplayEyebrow)) {
    heroEyebrowLine = primaryBadgeLabel
    primaryBadgeLabel = null
  } else if (input.heroDisplayEyebrow === '') {
    heroEyebrowLine = null
  } else {
    heroEyebrowLine = String(input.heroDisplayEyebrow).trim() || null
    primaryBadgeLabel = null
  }

  return {
    heroEyebrowLine,
    heroTitleLine,
    heroSubtitleLine,
    primaryBadgeLabel,
  }
}
