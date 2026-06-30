/** 광고성 문자 무료수신거부 번호 — 미리보기·발송 본문 조합 공통 */
export const SMS_AD_OPT_OUT_NUMBER = '0808811258'

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

/**
 * 광고성 문자 본문 조합 — (광고)표시명 + 본문 + 무료거부
 * @param {{ body: string; adDisplayName?: string | null; optOutNumber?: string | null }} input
 */
export function composeAdvertisementSmsMessage(input) {
  const body = String(input.body ?? '').trim()
  const adDisplayName = String(input.adDisplayName ?? '').trim()
  const optOutNumber = String(input.optOutNumber ?? SMS_AD_OPT_OUT_NUMBER).trim()

  if (!adDisplayName) {
    return {
      ok: false,
      code: 'sms_ad_display_name_required',
      publicMessage: '광고 표시명을 문자 설정에서 입력해 주세요.',
    }
  }

  const header = `(광고)${adDisplayName}`
  const footer = optOutNumber ? `무료거부 ${optOutNumber}` : null
  const message = [header, body, footer].filter(Boolean).join('\n')

  return {
    ok: true,
    message,
    header,
    body,
    footer,
  }
}
