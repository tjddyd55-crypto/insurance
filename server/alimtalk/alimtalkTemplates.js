/**
 * 보험 CRM 알림톡 템플릿 레지스트리.
 * 승인된 tpl_code 가 없으면 placeholder — 실발송 금지.
 */

export const TEMPLATE_KEY_CUSTOMER_APP_LINK = 'INSURANCE_CUSTOMER_APP_LINK'

export const PLACEHOLDER_TPL_CODE = 'PLACEHOLDER'

const CUSTOMER_APP_LINK_SUBJECT = '고객앱 안내'
const CUSTOMER_APP_LINK_BUTTON_NAME = '고객앱 열기'

/**
 * Aligo 승인 문구와 반드시 일치해야 실발송 가능.
 * 현재는 placeholder — 승인 원문 확정 후 교체.
 */
export function buildCustomerAppLinkMessage({ customerName, managerName }) {
  const name = String(customerName ?? '').trim() || '고객'
  const manager = String(managerName ?? '').trim() || '담당자'
  return [
    `${name}님, 고객앱 접속 링크를 안내드립니다.`,
    '아래 버튼을 눌러 필요한 내용을 확인하거나 자료를 첨부해 주세요.',
    '',
    `담당자: ${manager}`,
  ].join('\n')
}

/**
 * @param {{
 *   customerAppUrl: string,
 *   buttonName?: string,
 * }} input
 */
export function buildCustomerAppLinkButtonPayload(input) {
  const url = String(input.customerAppUrl ?? '').trim()
  const name = String(input.buttonName ?? CUSTOMER_APP_LINK_BUTTON_NAME).trim() || CUSTOMER_APP_LINK_BUTTON_NAME
  return {
    button: [
      {
        name,
        linkType: 'WL',
        linkTypeName: '웹링크',
        linkMo: url,
        linkPc: url,
      },
    ],
  }
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveCustomerAppLinkTplCode(env = process.env) {
  const fromEnv = String(env.INSURANCE_ALIGO_KAKAO_TPL_CUSTOMER_APP_LINK ?? '').trim()
  if (fromEnv) return fromEnv
  return PLACEHOLDER_TPL_CODE
}

/**
 * @param {string | null | undefined} tplCode
 */
export function isPlaceholderTplCode(tplCode) {
  const code = String(tplCode ?? '').trim()
  if (!code) return true
  const upper = code.toUpperCase()
  return (
    upper === PLACEHOLDER_TPL_CODE ||
    upper.startsWith('PLACEHOLDER') ||
    upper.includes('TODO') ||
    upper.includes('PENDING')
  )
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function getCustomerAppLinkTemplate(env = process.env) {
  const tplCode = resolveCustomerAppLinkTplCode(env)
  return {
    key: TEMPLATE_KEY_CUSTOMER_APP_LINK,
    subject: CUSTOMER_APP_LINK_SUBJECT,
    buttonName: CUSTOMER_APP_LINK_BUTTON_NAME,
    tplCode,
    isPlaceholder: isPlaceholderTplCode(tplCode),
    buildMessage: buildCustomerAppLinkMessage,
    buildButtonPayload: buildCustomerAppLinkButtonPayload,
  }
}
