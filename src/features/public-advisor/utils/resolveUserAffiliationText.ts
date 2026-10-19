/** 모바일 명함 소속 표시. 사용자가 저장한 Hero 보조 문구만 반환한다. */
export function resolveUserAffiliationText(input: {
  heroDisplaySubtitle?: string | null
  heroDisplaySubtitleVisible?: boolean | null
}): string {
  if (input.heroDisplaySubtitleVisible === false) return ''
  return String(input.heroDisplaySubtitle ?? '').trim()
}
