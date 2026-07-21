/**
 * 보험 CRM 카카오 알림톡 전용 설정.
 * SMS(ALIGO_*) / 자동문자 env 를 읽지 않는다 — INSURANCE_ALIGO_KAKAO_* 만 사용.
 */

const ALIGO_ALIMTALK_SEND_URL = 'https://kakaoapi.aligo.in/akv10/alimtalk/send/'
const ALIGO_ALIMTALK_PROFILE_LIST_URL = 'https://kakaoapi.aligo.in/akv10/profile/list/'

function normalizeBooleanEnv(raw, defaultValue = false) {
  if (raw == null || String(raw).trim() === '') {
    return defaultValue
  }
  const s = String(raw).trim().toUpperCase()
  return s === '1' || s === 'TRUE' || s === 'YES' || s === 'Y' || s === 'ON' || s === 'T'
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function loadInsuranceAlimtalkConfig(env = process.env) {
  const dryRunRaw = env.INSURANCE_ALIGO_KAKAO_DRY_RUN
  const dryRun =
    dryRunRaw != null && String(dryRunRaw).trim() !== ''
      ? normalizeBooleanEnv(dryRunRaw, true)
      : true

  const testModeRaw = String(env.INSURANCE_ALIGO_KAKAO_TEST_MODE ?? 'N').trim().toUpperCase()
  const testMode = testModeRaw === 'Y' || testModeRaw === '1' || testModeRaw === 'TRUE' ? 'Y' : 'N'

  const sendTimeoutMs = (() => {
    const n = Number(env.INSURANCE_ALIGO_KAKAO_SEND_TIMEOUT_MS ?? 8000)
    if (!Number.isFinite(n) || n < 3000) return 8000
    return Math.min(n, 15000)
  })()

  // 검수중 템플릿 실발송 차단 — 승인 후에만 true 로 올린다.
  const customerAppLinkApproved = normalizeBooleanEnv(
    env.INSURANCE_ALIGO_KAKAO_CUSTOMER_APP_LINK_APPROVED,
    false,
  )
  const customerRegistrationLinkApproved = normalizeBooleanEnv(
    env.INSURANCE_ALIGO_KAKAO_CUSTOMER_REGISTRATION_LINK_APPROVED,
    false,
  )
  const allowRealSend = normalizeBooleanEnv(env.INSURANCE_ALIGO_KAKAO_ALLOW_REAL_SEND, false)

  /**
   * Railway → EC2 relay (알리고 IP 화이트리스트).
   * 미설정 시 kakaoapi.aligo.in 직접 호출(Railway IP 미등록 시 -99 실패).
   */
  const gatewayUrl = String(env.INSURANCE_ALIGO_KAKAO_GATEWAY_URL ?? '')
    .trim()
    .replace(/\/+$/, '')
  const gatewayToken = String(
    env.INSURANCE_ALIGO_KAKAO_GATEWAY_TOKEN ?? env.SMS_MODULE_GATEWAY_TOKEN ?? '',
  ).trim()
  const useGateway = Boolean(gatewayUrl)

  return {
    apiKey: String(env.INSURANCE_ALIGO_KAKAO_API_KEY ?? '').trim(),
    userId: String(env.INSURANCE_ALIGO_KAKAO_USER_ID ?? '').trim(),
    senderKey: String(env.INSURANCE_ALIGO_KAKAO_SENDER_KEY ?? '').trim(),
    sender: String(env.INSURANCE_ALIGO_KAKAO_SENDER ?? '')
      .trim()
      .replace(/\D/g, ''),
    dryRun,
    testMode,
    sendTimeoutMs,
    sendUrl: ALIGO_ALIMTALK_SEND_URL,
    profileListUrl: ALIGO_ALIMTALK_PROFILE_LIST_URL,
    gatewayUrl,
    gatewayToken,
    useGateway,
    provider: useGateway ? 'aligo_alimtalk_gateway' : 'aligo_alimtalk',
    /** UJ_6184 검수 완료 후에만 true */
    customerAppLinkApproved,
    /** UJ_6670 승인 완료 후에만 true */
    customerRegistrationLinkApproved,
    /** 전역 실발송 허용 (기본 false) */
    allowRealSend,
  }
}

/**
 * 고객앱 링크 알림톡 실발송 가능 여부 (승인 flag 모두 true 여야 함).
 * @param {ReturnType<typeof loadInsuranceAlimtalkConfig>} config
 */
export function isCustomerAppLinkRealSendApproved(config) {
  return Boolean(config?.customerAppLinkApproved && config?.allowRealSend)
}

/**
 * 고객등록 링크 알림톡 실발송 가능 여부.
 * @param {ReturnType<typeof loadInsuranceAlimtalkConfig>} config
 */
export function isCustomerRegistrationLinkRealSendApproved(config) {
  return Boolean(config?.customerRegistrationLinkApproved && config?.allowRealSend)
}

/**
 * @param {ReturnType<typeof loadInsuranceAlimtalkConfig>} config
 */
export function isInsuranceAlimtalkCredentialsComplete(config) {
  return Boolean(config?.apiKey && config?.userId && config?.senderKey && config?.sender)
}

export { ALIGO_ALIMTALK_SEND_URL, ALIGO_ALIMTALK_PROFILE_LIST_URL }
