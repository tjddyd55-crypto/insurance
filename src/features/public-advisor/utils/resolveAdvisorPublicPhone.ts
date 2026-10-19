/** Hero/CTA용 공개 전화번호 — publicPhone 우선, 비어 있으면 계정 번호 fallback (공개 ON일 때만) */
export function resolveAdvisorPublicPhone(input: {
  publicPhone?: string | null
  showPublicPhone?: boolean | null
  accountPhone?: string | null
}): string {
  if (input.showPublicPhone === false) return ''
  const published = String(input.publicPhone ?? '').trim()
  if (published) return published
  return String(input.accountPhone ?? '').trim()
}
