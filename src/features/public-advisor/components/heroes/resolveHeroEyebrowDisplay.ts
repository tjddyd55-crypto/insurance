/** Hero 상단 라벨 — 직접 입력 '' 은 비노출, null/undefined 는 테마 기본 문구 */
export function resolveHeroEyebrowWithDefault(
  heroEyebrowLine: string | null,
  primaryBadgeLabel: string | null,
  heroDisplayEyebrowRaw: string | null | undefined,
  defaultLabel = 'ONE FC',
): string | null {
  if (heroDisplayEyebrowRaw === '') return null
  if (heroEyebrowLine) return heroEyebrowLine
  if (primaryBadgeLabel) return primaryBadgeLabel
  if (heroDisplayEyebrowRaw === null || heroDisplayEyebrowRaw === undefined) return defaultLabel
  return null
}
