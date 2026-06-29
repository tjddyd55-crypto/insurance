/**
 * EUC-KR 기준 byte 길이 근사 (한글 2byte, ASCII 1byte)
 * @param {string} text
 */
export function estimateSmsByteLength(text) {
  let bytes = 0
  for (const ch of String(text ?? '')) {
    const code = ch.charCodeAt(0)
    bytes += code <= 0x7f ? 1 : 2
  }
  return bytes
}

/**
 * @param {string} message
 * @returns {'SMS' | 'LMS'}
 */
export function resolveMessageType(message) {
  return estimateSmsByteLength(message) <= 90 ? 'SMS' : 'LMS'
}

/**
 * @param {string} template
 * @param {{ customerName?: string | null }} vars
 */
export function renderSmsTemplate(template, vars) {
  const name = String(vars.customerName ?? '').trim() || '고객'
  return String(template ?? '').replace(/\{고객명\}/g, name)
}
