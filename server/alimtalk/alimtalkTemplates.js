/**
 * 보험 CRM 알림톡 템플릿 레지스트리.
 *
 * 고객앱 링크: UJ_6184 (@crm솔루션 / 고객앱 접속 링크 안내)
 * 검수중 — 승인 전 실발송은 approval flag + DRY_RUN 으로 차단.
 */

export const TEMPLATE_KEY_CUSTOMER_APP_LINK = 'INSURANCE_CUSTOMER_APP_LINK'

/** 검수·승인 예정 템플릿 코드 (카카오 비즈메시지) */
export const CUSTOMER_APP_LINK_TPL_CODE = 'UJ_6184'

export const PLACEHOLDER_TPL_CODE = 'PLACEHOLDER'

const CUSTOMER_APP_LINK_SUBJECT = '고객앱 안내'
const CUSTOMER_APP_LINK_BUTTON_NAME = '고객앱 열기'
const CUSTOMER_APP_LINK_TEMPLATE_NAME = '고객앱 접속 링크 안내'
const CUSTOMER_APP_LINK_CHANNEL_NAME = '@crm솔루션'

/**
 * 카카오 심사 신청 문구와 100% 일치해야 실발송 가능.
 * (검수 완료 후 승인 원문이 다르면 즉시 교체)
 */
export function buildCustomerAppLinkMessage({ customerName, managerName }) {
  const name = String(customerName ?? '').trim() || '고객'
  const manager = String(managerName ?? '').trim() || '담당자'
  return [
    `${name}님, 안녕하세요.`,
    `${manager}입니다.`,
    '',
    '요청하신 보험 업무 확인 및 자료 첨부를 위해 고객앱 접속 링크를 안내드립니다.',
    '아래 [고객앱 열기] 버튼을 눌러 내용을 확인해 주세요.',
    '',
    '※ 본 링크는 고객님의 보험 업무 확인 및 자료 제출을 위한 안내입니다.',
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
  return CUSTOMER_APP_LINK_TPL_CODE
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
    templateName: CUSTOMER_APP_LINK_TEMPLATE_NAME,
    channelName: CUSTOMER_APP_LINK_CHANNEL_NAME,
    failover: 'N',
    tplCode,
    isPlaceholder: isPlaceholderTplCode(tplCode),
    buildMessage: buildCustomerAppLinkMessage,
    buildButtonPayload: buildCustomerAppLinkButtonPayload,
  }
}
