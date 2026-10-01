const INVALID_FILE_NAME_CHARS = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|'])
const MAX_FILE_NAME_PART_LENGTH = 40
const SIMULATION_NAME_FALLBACK = '보장시뮬레이션'

function isInvalidFileNameChar(char) {
  const code = char.codePointAt(0) ?? 0
  if (code <= 0x1f || code === 0x7f) return true
  return INVALID_FILE_NAME_CHARS.has(char)
}

function sanitizeFilePart(value) {
  const stripped = Array.from(String(value ?? ''))
    .filter((char) => !isInvalidFileNameChar(char))
    .join('')
  const collapsed = stripped.replace(/\s+/g, ' ').trim()
  return Array.from(collapsed).slice(0, MAX_FILE_NAME_PART_LENGTH).join('')
}

function customerNameFromScenario(scenario) {
  if (scenario?.customerNameSnapshot != null && String(scenario.customerNameSnapshot).trim()) {
    return String(scenario.customerNameSnapshot)
  }
  if (scenario?.customerName != null && String(scenario.customerName).trim()) {
    return String(scenario.customerName)
  }
  return ''
}

/** 클라이언트 `buildCoveragePdfFileName` 과 같은 규칙. Content-Disposition 전용. */
export function buildCoveragePdfFileNameFromScenario(scenario) {
  const customer = sanitizeFilePart(customerNameFromScenario(scenario))
  const simulation = sanitizeFilePart(scenario?.title ?? '')
  const parts = [customer, simulation].filter(Boolean)
  if (parts.length === 0) return `${SIMULATION_NAME_FALLBACK}.pdf`
  return `${parts.join('_')}.pdf`
}
