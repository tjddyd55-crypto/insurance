/** 사용자 화면: 외부 링크만 허용하고 잘못된 URL은 무시한다. */

export function safeOpenUrl(raw: string | undefined | null): void {
  const u = String(raw ?? '').trim()
  if (!u) return
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return
    window.open(parsed.href, '_blank', 'noopener,noreferrer')
  } catch {
    /* invalid URL */
  }
}

/** 표시용 로고 URL — `/` 로 시작하는 자체 호스팅 경로만 허용 (외부 hotlink 금지). */
export function logoSrcForUi(logoPath: string | undefined | null): string {
  const p = String(logoPath ?? '').trim()
  if (!p.startsWith('/')) return ''
  return p
}
