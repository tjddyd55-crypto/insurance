export type AdvisorHeroDisplayInput = {
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
  heroTitleLine: string
  heroSubtitleLine: string
  primaryBadgeLabel: string | null
}

export function resolveAdvisorHeroDisplay(input: AdvisorHeroDisplayInput): ResolvedAdvisorHeroDisplay {
  const displayName = String(input.displayName ?? '').trim()
  const titleSuffix = String(input.titleLabel ?? 'FC').trim() || 'FC'
  const autoTitle = [displayName, titleSuffix].filter(Boolean).join(' ').trim() || 'ONE FC'
  const autoSubtitle = [input.gaName, input.teamName].filter(Boolean).join(' · ').trim()

  const heroTitleLine = String(input.heroDisplayTitle ?? '').trim() || autoTitle
  const heroSubtitleLine = String(input.heroDisplaySubtitle ?? '').trim() || autoSubtitle
  const customEyebrow = String(input.heroDisplayEyebrow ?? '').trim()
  const heroEyebrowLine = customEyebrow || null

  const primaryBadgeLabel = customEyebrow
    ? null
    : String(input.primaryBadgeLabel ?? '').trim() || null

  return {
    heroEyebrowLine,
    heroTitleLine,
    heroSubtitleLine,
    primaryBadgeLabel,
  }
}
