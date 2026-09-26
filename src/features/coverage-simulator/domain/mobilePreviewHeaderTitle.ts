/** Mobile Header 표시용 — 시스템 기본 시나리오명만 짧게, 사용자 템플릿명은 원문 + ellipsis */
export function mobilePreviewHeaderTitle(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) return '시나리오'
  return trimmed.replace(/ 시나리오$/, '')
}
