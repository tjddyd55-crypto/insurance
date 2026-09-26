/** Time marker 라벨 → 구간 합계 라벨 (예: `1년 후` → `1년간 합계`) */
export function periodSubtotalLabelFromMarker(markerLabel: string): string {
  const trimmed = markerLabel.trim()
  if (!trimmed) return '구간 합계'
  if (trimmed.endsWith('후')) {
    const span = trimmed.replace(/\s*후\s*$/, '')
    if (span) return `${span}간 합계`
  }
  return '구간 합계'
}
