/** 광고성 문자 무료수신거부 번호 — 미리보기·발송 본문 조합 공통 */
export const SMS_AD_OPT_OUT_NUMBER = '0808811258'

const TEMPLATE_VAR_PATTERN = /\{([^}]+)\}/g

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
 * @param {{
 *   customerName?: string | null;
 *   agentName?: string | null;
 *   agentPhone?: string | null;
 *   referenceDate?: string | null;
 *   dDayLabel?: string | null;
 * }} vars
 */
export function buildSmsTemplateVariableMap(vars) {
  const customerName = String(vars.customerName ?? '').trim()
  return {
    고객명: customerName || '고객',
    담당자명: String(vars.agentName ?? '').trim(),
    담당자연락처: String(vars.agentPhone ?? '').trim(),
    기준일: String(vars.referenceDate ?? '').trim(),
    'D일': String(vars.dDayLabel ?? '당일').trim(),
  }
}

/**
 * @param {string} template
 * @param {{
 *   customerName?: string | null;
 *   agentName?: string | null;
 *   agentPhone?: string | null;
 *   referenceDate?: string | null;
 *   dDayLabel?: string | null;
 * }} vars
 */
export function renderSmsTemplateDetailed(template, vars) {
  const map = buildSmsTemplateVariableMap(vars)
  const usedTokens = new Set()
  for (const match of String(template ?? '').matchAll(TEMPLATE_VAR_PATTERN)) {
    usedTokens.add(match[1])
  }

  const missing = []
  for (const token of usedTokens) {
    if (!(token in map)) {
      continue
    }
    const value = map[token]
    if (value == null || String(value).trim() === '') {
      missing.push(token)
    }
  }

  let messageBody = String(template ?? '')
  for (const [key, value] of Object.entries(map)) {
    messageBody = messageBody.replaceAll(`{${key}}`, value || '')
  }

  return { messageBody, missingVariables: missing }
}

/**
 * @param {string} template
 * @param {{
 *   customerName?: string | null;
 *   agentName?: string | null;
 *   agentPhone?: string | null;
 *   referenceDate?: string | null;
 *   dDayLabel?: string | null;
 * }} vars
 */
export function renderSmsTemplate(template, vars) {
  return renderSmsTemplateDetailed(template, vars).messageBody
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
