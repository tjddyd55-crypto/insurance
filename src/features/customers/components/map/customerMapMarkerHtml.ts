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
  const cls = selected
    ? 'customer-map-marker customer-map-marker--selected'
    : 'customer-map-marker'
  const label = escapeMarkerLabelHtml(truncateMarkerLabel(customerName))
  return `<div class="${cls}"><span class="customer-map-marker__label">${label}</span><span class="customer-map-marker__pin" aria-hidden="true"></span></div>`
}
