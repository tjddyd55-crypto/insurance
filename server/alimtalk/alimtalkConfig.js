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
    /**
     * 청구 접수 알림톡(UJ_9750) — 기존 템플릿 APPROVED flag 와 독립.
     * 기본 enabled/realSend = true (실발송 모드). 미승인 템플릿은 Aligo 거절 → FAILED.
     */
    claimReceivedEnabled: normalizeBooleanEnv(
      env.INSURANCE_ALIGO_KAKAO_CLAIM_RECEIVED_ENABLED,
      true,
    ),
    claimReceivedAllowRealSend: normalizeBooleanEnv(
      env.INSURANCE_ALIGO_KAKAO_CLAIM_RECEIVED_ALLOW_REAL_SEND,
      true,
    ),
    claimReceivedTplCode: String(
      env.INSURANCE_ALIGO_KAKAO_CLAIM_RECEIVED_TEMPLATE_CODE ?? 'UJ_9750',
    )
      .trim() || 'UJ_9750',
    /** development 실발송 안전장치 */
    claimDevRealSendEnabled: normalizeBooleanEnv(
      env.INSURANCE_ALIGO_KAKAO_DEV_REAL_SEND_ENABLED ??
        env.INSURANCE_ALIGO_KAKAO_CLAIM_RECEIVED_DEV_REAL_SEND_ENABLED,
      false,
    ),
    claimDevRecipientAllowlist: parsePhoneAllowlist(
      env.INSURANCE_ALIGO_KAKAO_DEV_RECIPIENT_ALLOWLIST ??
        env.INSURANCE_ALIGO_KAKAO_CLAIM_RECEIVED_DEV_RECIPIENT_ALLOWLIST,
    ),
  }
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
function parsePhoneAllowlist(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return []
  return text
    .split(/[,;\s]+/)
    .map((part) => part.replace(/\D/g, ''))
    .filter((digits) => digits.length >= 10)
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

/**
 * production vs non-production 판별 (Railway develop 은 NODE_ENV=production 일 수 있음).
 * @param {{ nodeEnv?: string }} [opts]
 */
export function resolveAlimtalkRuntimeTier(opts = {}) {
  const dbEnv = String(process.env.INSURANCE_DB_ENVIRONMENT ?? '').trim().toLowerCase()
  const railwayEnv = String(
    process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.RAILWAY_ENVIRONMENT ?? '',
  )
    .trim()
    .toLowerCase()
  if (dbEnv === 'production' || railwayEnv === 'production') return 'production'
  if (
    dbEnv === 'development' ||
    railwayEnv === 'development' ||
    railwayEnv === 'develop' ||
    railwayEnv.includes('dev')
  ) {
    return 'development'
  }
  const nodeEnv = String(opts.nodeEnv ?? process.env.NODE_ENV ?? '').trim().toLowerCase()
  return nodeEnv === 'production' ? 'production' : 'development'
}

/**
 * 청구 접수 알림톡 실발송 가능 여부 (기존 UJ_6184/UJ_6670 APPROVED 와 무관).
 * @param {ReturnType<typeof loadInsuranceAlimtalkConfig>} config
 * @param {{ receiverDigits?: string, nodeEnv?: string }} [opts]
 */
export function isClaimReceivedRealSendAllowed(config, opts = {}) {
  if (!config?.claimReceivedEnabled) return false
  if (!config?.claimReceivedAllowRealSend) return false
  if (!isInsuranceAlimtalkCredentialsComplete(config)) return false
  const tier = resolveAlimtalkRuntimeTier(opts)
  if (tier === 'production') return true
  // development/local: 명시적 실발송 + allowlist
  if (!config.claimDevRealSendEnabled) return false
  const digits = String(opts.receiverDigits ?? '').replace(/\D/g, '')
  if (!digits) return false
  return Array.isArray(config.claimDevRecipientAllowlist)
    ? config.claimDevRecipientAllowlist.includes(digits)
    : false
}

/**
 * 비밀값 없는 청구 알림톡 diagnostics 스냅샷.
 * @param {ReturnType<typeof loadInsuranceAlimtalkConfig>} [config]
 */
export function getClaimReceivedAlimtalkDiagnostics(config = loadInsuranceAlimtalkConfig()) {
  return {
    kakaoCredentials: isInsuranceAlimtalkCredentialsComplete(config) ? 'present' : 'missing',
    senderKey: config.senderKey ? 'present' : 'missing',
    sender: config.sender ? 'present' : 'missing',
    claimTemplateCode: config.claimReceivedTplCode,
    claimAlimtalkEnabled: Boolean(config.claimReceivedEnabled),
    claimRealSend: Boolean(config.claimReceivedAllowRealSend),
    claimDevRealSendEnabled: Boolean(config.claimDevRealSendEnabled),
    claimDevAllowlistCount: Array.isArray(config.claimDevRecipientAllowlist)
      ? config.claimDevRecipientAllowlist.length
      : 0,
    gatewayConfigured: Boolean(config.useGateway && config.gatewayUrl),
    globalDryRun: Boolean(config.dryRun),
    globalAllowRealSend: Boolean(config.allowRealSend),
  }
}

export { ALIGO_ALIMTALK_SEND_URL, ALIGO_ALIMTALK_PROFILE_LIST_URL }
