/**
 * 보험 CRM 알림톡 템플릿 레지스트리.
 *
 * 승인 원문 SSOT = Aligo template/list (inspStatus=APR) 기준.
 * message_1 / button 은 승인 템플릿과 100% 일치해야 한다.
 * (불일치 시 Aligo code 0 접수 후에도 Kakao rslt=U "메시지가 템플릿과 일치하지않음")
 */

import { forceHttpsPublicUrl, toAligoEmbeddedWebLinkValue } from './alimtalkPublicUrl.js'

export const TEMPLATE_KEY_CUSTOMER_APP_LINK = 'INSURANCE_CUSTOMER_APP_LINK'

/** 검수·승인 템플릿 코드 (카카오 비즈메시지) */
export const CUSTOMER_APP_LINK_TPL_CODE = 'UJ_6184'

export const PLACEHOLDER_TPL_CODE = 'PLACEHOLDER'

const CUSTOMER_APP_LINK_SUBJECT = '고객앱 안내'
const CUSTOMER_APP_LINK_BUTTON_NAME = '고객앱 열기'
const CUSTOMER_APP_LINK_TEMPLATE_NAME = '고객앱 접속 링크 안내'
const CUSTOMER_APP_LINK_CHANNEL_NAME = '@crm솔루션'

/** Aligo template/list templtContent (UJ_6184) — 변수 치환 전 원문 */
export const CUSTOMER_APP_LINK_APPROVED_TEMPLATE = [
  '#{고객명}님, 안녕하세요.',
  '#{담당자명}입니다.',
  '',
  '요청하신 보험 업무 확인 및 자료 첨부를 위해 고객앱 접속 링크를 안내드립니다.',
  '아래 [고객앱 열기] 버튼을 눌러 내용을 확인해 주세요.',
  '',
  '※ 본 링크는 고객님의 보험 업무 확인 및 자료 제출을 위한 안내입니다.',
].join('\n')

/**
 * 카카오 승인 문구에 변수 치환 (국가지원사업과 동일 패턴).
 * @param {{ customerName: string, managerName: string }} input
 */
export function buildCustomerAppLinkMessage({ customerName, managerName }) {
  const name = String(customerName ?? '').trim() || '고객'
  const manager = String(managerName ?? '').trim() || '담당자'
  return CUSTOMER_APP_LINK_APPROVED_TEMPLATE.replaceAll('#{고객명}', name).replaceAll(
    '#{담당자명}',
    manager,
  )
}

/**
 * @param {{
 *   customerAppUrl: string,
 *   buttonName?: string,
 * }} input
 */
export function buildCustomerAppLinkButtonPayload(input) {
  const url = forceHttpsPublicUrl(String(input.customerAppUrl ?? '').trim())
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

/* -------------------------------------------------------------------------- */
/* 고객정보 등록 링크 — UJ_6670 (강조표기형)                                       */
/* -------------------------------------------------------------------------- */

export const TEMPLATE_KEY_CUSTOMER_REGISTRATION_LINK = 'INSURANCE_CUSTOMER_REGISTRATION_LINK'

/** 승인 템플릿 코드 (강조표기형 · TEXT) */
export const CUSTOMER_REGISTRATION_LINK_TPL_CODE = 'UJ_6670'

/**
 * Aligo subject_1 — 알림톡 제목(필수).
 * 승인 타이틀과 동일하게 유지.
 */
const CUSTOMER_REGISTRATION_LINK_SUBJECT = '고객정보 등록 안내'

/**
 * Aligo emtitle_1 — 강조표기형 타이틀(templtTitle).
 * 공식 send API 필드명: emtitle_1 (알리고 카카오 알림톡 API).
 */
export const CUSTOMER_REGISTRATION_LINK_EMTITLE = '고객정보 등록 안내'

/**
 * 강조표기형 서브타이틀(templtSubtitle).
 * 템플릿 등록 시 고정값 — Aligo send API 전송 필드 없음(emtitle_1 만 존재).
 * 승인 원문 SSOT 검증용으로만 보관.
 */
export const CUSTOMER_REGISTRATION_LINK_SUBTITLE = '보험 상담을 위한 고객정보 등록'

const CUSTOMER_REGISTRATION_LINK_BUTTON_NAME = '고객정보 등록'
const CUSTOMER_REGISTRATION_LINK_TEMPLATE_NAME = '고객정보 등록 안내'
const CUSTOMER_REGISTRATION_LINK_CHANNEL_NAME = '@crm솔루션'

/**
 * Aligo template/list templtContent (UJ_6670) — 승인 원문 그대로.
 * (UJ_6324 의 "버튼명:" 블록은 본문에서 제거됨)
 */
export const CUSTOMER_REGISTRATION_LINK_APPROVED_TEMPLATE = [
  '안녕하세요.',
  '담당자 #{담당자명}입니다.',
  '',
  '보험 상담 및 업무 진행을 위해 고객정보 등록 링크를 안내드립니다.',
  '',
  '아래 [고객정보 등록] 버튼을 눌러 필요한 정보를 입력해 주세요.',
  '',
  '※ 본 링크는 보험 상담 및 업무 처리를 위한 고객정보 등록 안내입니다.',
].join('\n')

/**
 * @param {{ managerName: string }} input
 */
export function buildCustomerRegistrationLinkMessage({ managerName }) {
  const manager = String(managerName ?? '').trim() || '담당자'
  return CUSTOMER_REGISTRATION_LINK_APPROVED_TEMPLATE.replaceAll('#{담당자명}', manager)
}

/**
 * @param {{
 *   registrationUrl: string,
 *   buttonName?: string,
 * }} input
 */
export function buildCustomerRegistrationLinkButtonPayload(input) {
  const url = forceHttpsPublicUrl(String(input.registrationUrl ?? '').trim())
  const name =
    String(input.buttonName ?? CUSTOMER_REGISTRATION_LINK_BUTTON_NAME).trim() ||
    CUSTOMER_REGISTRATION_LINK_BUTTON_NAME
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
export function resolveCustomerRegistrationLinkTplCode(env = process.env) {
  const fromEnv = String(env.INSURANCE_ALIGO_KAKAO_TPL_CUSTOMER_REGISTRATION_LINK ?? '').trim()
  if (fromEnv) return fromEnv
  return CUSTOMER_REGISTRATION_LINK_TPL_CODE
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function getCustomerRegistrationLinkTemplate(env = process.env) {
  const tplCode = resolveCustomerRegistrationLinkTplCode(env)
  return {
    key: TEMPLATE_KEY_CUSTOMER_REGISTRATION_LINK,
    subject: CUSTOMER_REGISTRATION_LINK_SUBJECT,
    /** Aligo emtitle_1 */
    emtitle: CUSTOMER_REGISTRATION_LINK_EMTITLE,
    /** 템플릿 등록 고정값(전송 필드 아님) */
    subtitle: CUSTOMER_REGISTRATION_LINK_SUBTITLE,
    buttonName: CUSTOMER_REGISTRATION_LINK_BUTTON_NAME,
    templateName: CUSTOMER_REGISTRATION_LINK_TEMPLATE_NAME,
    channelName: CUSTOMER_REGISTRATION_LINK_CHANNEL_NAME,
    failover: 'N',
    templateEmType: 'TEXT',
    tplCode,
    isPlaceholder: isPlaceholderTplCode(tplCode),
    buildMessage: buildCustomerRegistrationLinkMessage,
    buildButtonPayload: buildCustomerRegistrationLinkButtonPayload,
  }
}

/* -------------------------------------------------------------------------- */
/* 보험 청구 접수 알림 — UJ_9750 (담당 CRM 사용자 · 버튼/링크 없음)                 */
/* -------------------------------------------------------------------------- */

export const TEMPLATE_KEY_CLAIM_RECEIVED = 'INSURANCE_CLAIM_RECEIVED'
export const CLAIM_RECEIVED_TPL_CODE = 'UJ_9750'
export const CLAIM_RECEIVED_SUBJECT = '보험 청구 접수 알림'
export const CLAIM_RECEIVED_TEMPLATE_NAME = '보험 청구 접수 알림'

/**
 * 승인 요청 본문 SSOT — 공백·줄바꿈 유지. 민감정보/링크/버튼/접수구분 금지.
 */
export const CLAIM_RECEIVED_APPROVED_TEMPLATE = [
  '[ONE FC 청구 알림]',
  '',
  '#{고객명} 고객님의 새로운 보험 청구가 접수되었습니다.',
  '',
  '접수일시: #{접수일시}',
  '',
  'ONE FC 앱 또는 PC에서 청구 내용을 확인해 주세요.',
].join('\n')

/**
 * @param {{ customerName?: string | null, submittedAtLabel?: string | null }} input
 */
export function buildClaimReceivedMessage(input) {
  const customerName = String(input.customerName ?? '').trim() || '고객'
  const submittedAtLabel = String(input.submittedAtLabel ?? '').trim() || '—'
  return CLAIM_RECEIVED_APPROVED_TEMPLATE.replaceAll('#{고객명}', customerName).replaceAll(
    '#{접수일시}',
    submittedAtLabel,
  )
}

/** 버튼 없는 템플릿 — 빈 button 배열 */
export function buildClaimReceivedButtonPayload() {
  return { button: [] }
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveClaimReceivedTplCode(env = process.env) {
  const fromEnv = String(env.INSURANCE_ALIGO_KAKAO_CLAIM_RECEIVED_TEMPLATE_CODE ?? '').trim()
  if (fromEnv) return fromEnv
  return CLAIM_RECEIVED_TPL_CODE
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function getClaimReceivedTemplate(env = process.env) {
  const tplCode = resolveClaimReceivedTplCode(env)
  return {
    key: TEMPLATE_KEY_CLAIM_RECEIVED,
    subject: CLAIM_RECEIVED_SUBJECT,
    templateName: CLAIM_RECEIVED_TEMPLATE_NAME,
    channelName: '@crm솔루션',
    failover: 'N',
    tplCode,
    isPlaceholder: isPlaceholderTplCode(tplCode),
    buildMessage: buildClaimReceivedMessage,
    buildButtonPayload: buildClaimReceivedButtonPayload,
  }
}

/* -------------------------------------------------------------------------- */
/* 고객등록 링크 완료 알림 — 담당 CRM 사용자 · 고객 확인하기 버튼                    */
/* -------------------------------------------------------------------------- */

export const TEMPLATE_KEY_CUSTOMER_REGISTRATION_COMPLETED =
  'INSURANCE_CUSTOMER_REGISTRATION_COMPLETED'

/** 알리고 승인 전엔 env 미설정 → enqueue skip. production 템플릿 코드: UK_2268 */
export const CUSTOMER_REGISTRATION_COMPLETED_SUBJECT = 'ONE FC 고객등록 완료'
export const CUSTOMER_REGISTRATION_COMPLETED_TEMPLATE_NAME = 'ONE FC 고객등록 완료'
export const CUSTOMER_REGISTRATION_COMPLETED_BUTTON_NAME = '고객 확인하기'
/** Aligo 등록 템플릿 코드(검수중→승인 후 동일 코드 유지) */
export const CUSTOMER_REGISTRATION_COMPLETED_EXPECTED_TPL_CODE = 'UK_2268'

/**
 * 승인 요청 본문 SSOT — Aligo UK_2268 실제 templtContent 와 일치해야 함.
 * URL 은 본문이 아니라 버튼에만. 버튼 계약: http://#{고객확인링크}
 */
export const CUSTOMER_REGISTRATION_COMPLETED_APPROVED_TEMPLATE = [
  '[ONE FC 고객등록 완료]',
  '',
  '#{고객명} 고객님의 정보 등록이 완료되었습니다.',
  '',
  '고객등록 링크를 통해 접수된 고객입니다.',
  'ONE FC 고객관리에서 등록 내용을 확인해 주세요.',
  '',
  '등록일시: #{등록일시}',
].join('\n')

/**
 * @param {{ customerName?: string | null, registeredAtLabel?: string | null }} input
 */
export function buildCustomerRegistrationCompletedMessage(input) {
  const customerName = String(input.customerName ?? '').trim() || '신규 고객'
  const registeredAtLabel = String(input.registeredAtLabel ?? '').trim() || '—'
  return CUSTOMER_REGISTRATION_COMPLETED_APPROVED_TEMPLATE.replaceAll(
    '#{고객명}',
    customerName,
  ).replaceAll('#{등록일시}', registeredAtLabel)
}

/**
 * @param {{
 *   customerCheckUrl: string,
 *   buttonName?: string,
 * }} input
 */
export function buildCustomerRegistrationCompletedButtonPayload(input) {
  // UK_2268 버튼 계약: http://#{고객확인링크} → scheme 제외값만 전달 (이중 scheme 금지)
  const url = toAligoEmbeddedWebLinkValue(String(input.customerCheckUrl ?? '').trim())
  const name =
    String(input.buttonName ?? CUSTOMER_REGISTRATION_COMPLETED_BUTTON_NAME).trim() ||
    CUSTOMER_REGISTRATION_COMPLETED_BUTTON_NAME
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
export function resolveCustomerRegistrationCompletedTplCode(env = process.env) {
  return String(
    env.INSURANCE_ALIGO_KAKAO_CUSTOMER_REGISTRATION_COMPLETED_TEMPLATE_CODE ?? '',
  ).trim()
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function getCustomerRegistrationCompletedTemplate(env = process.env) {
  const tplCode = resolveCustomerRegistrationCompletedTplCode(env)
  return {
    key: TEMPLATE_KEY_CUSTOMER_REGISTRATION_COMPLETED,
    subject: CUSTOMER_REGISTRATION_COMPLETED_SUBJECT,
    buttonName: CUSTOMER_REGISTRATION_COMPLETED_BUTTON_NAME,
    templateName: CUSTOMER_REGISTRATION_COMPLETED_TEMPLATE_NAME,
    channelName: '@crm솔루션',
    failover: 'N',
    tplCode,
    isPlaceholder: isPlaceholderTplCode(tplCode),
    buildMessage: buildCustomerRegistrationCompletedMessage,
    buildButtonPayload: buildCustomerRegistrationCompletedButtonPayload,
  }
}
