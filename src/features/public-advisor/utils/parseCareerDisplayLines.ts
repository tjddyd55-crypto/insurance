/**
 * 경력 텍스트에서 소속 중복 구문을 제거하고 표시용 줄 목록을 만든다.
 */
export function parseCareerDisplayLines(
  careerText: string,
  gaName: string | null | undefined,
  teamName: string | null | undefined,
): string[] {
  const raw = String(careerText ?? '').trim()
  if (!raw) return []

  const affiliationTokens = [gaName, teamName]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)

  const segments = raw
    .split(/[·|•\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  return segments.filter((seg) => {
    if (/소속\s*$/.test(seg) && affiliationTokens.some((t) => seg.includes(t))) {
      return false
    }
    for (const token of affiliationTokens) {
      if (seg === token || seg === `${token} 소속`) return false
      if (seg.startsWith(token) && /소속/.test(seg) && seg.length < token.length + 8) return false
    }
    return true
  })
}
