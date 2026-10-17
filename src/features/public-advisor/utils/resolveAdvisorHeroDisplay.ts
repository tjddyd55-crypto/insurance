export type AdvisorHeroDisplayInput = {
  heroDisplayEyebrow?: string | null
  heroDisplayTitle?: string | null
  heroDisplaySubtitle?: string | null
  heroDisplayEyebrowVisible?: boolean | null
  heroDisplayTitleVisible?: boolean | null
  heroDisplaySubtitleVisible?: boolean | null
}

export type ResolvedAdvisorHeroDisplay = {
  heroEyebrowLine: string | null
  heroTitleLine: string | null
  heroSubtitleLine: string | null
}

function lineText(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed || null
}

function isVisible(flag: boolean | null | undefined): boolean {
  return flag !== false
}

export function resolveAdvisorHeroDisplay(input: AdvisorHeroDisplayInput): ResolvedAdvisorHeroDisplay {
  return {
    heroEyebrowLine: isVisible(input.heroDisplayEyebrowVisible) ? lineText(input.heroDisplayEyebrow) : null,
    heroTitleLine: isVisible(input.heroDisplayTitleVisible) ? lineText(input.heroDisplayTitle) : null,
    heroSubtitleLine: isVisible(input.heroDisplaySubtitleVisible) ? lineText(input.heroDisplaySubtitle) : null,
  }
}

/** 신규 프로필 편집용 예시값 (DB insert 시 서버와 동일 문자열 유지) */
export const ADVISOR_HERO_EDITOR_SAMPLE_PRESET = {
  heroDisplayEyebrow: 'ONE FC',
  heroDisplayTitle: '홍길동 FC',
  heroDisplaySubtitle: '영진에셋 · 팀장',
} as const
