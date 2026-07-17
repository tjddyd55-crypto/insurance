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
    provider: 'aligo_alimtalk',
  }
}

/**
 * @param {ReturnType<typeof loadInsuranceAlimtalkConfig>} config
 */
export function isInsuranceAlimtalkCredentialsComplete(config) {
  return Boolean(config?.apiKey && config?.userId && config?.senderKey && config?.sender)
}

export { ALIGO_ALIMTALK_SEND_URL, ALIGO_ALIMTALK_PROFILE_LIST_URL }
