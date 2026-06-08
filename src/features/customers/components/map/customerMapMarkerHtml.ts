/** Naver Marker icon.size / icon.anchor 와 HTML wrapper 크기를 일치시킨다. */
export const CUSTOMER_MAP_NAME_MARKER_SIZE = {
  width: 120,
  height: 44,
  anchorX: 60,
  anchorY: 40,
} as const

const MAX_MARKER_LABEL_CHARS = 12

export function truncateMarkerLabel(name: string): string {
  const trimmed = name.trim() || '이름 없음'
  if (trimmed.length <= MAX_MARKER_LABEL_CHARS) {
    return trimmed
  }
  return `${trimmed.slice(0, MAX_MARKER_LABEL_CHARS)}…`
}

export function escapeMarkerLabelHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildCustomerMapMarkerHtml(customerName: string, selected: boolean): string {
  const modifier = selected ? ' customer-map-name-marker--selected' : ''
  const label = escapeMarkerLabelHtml(truncateMarkerLabel(customerName))
  return `<div class="customer-map-name-marker${modifier}"><div class="customer-map-name-marker__label">${label}</div><div class="customer-map-name-marker__pin" aria-hidden="true"></div></div>`
}
