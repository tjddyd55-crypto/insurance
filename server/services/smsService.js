import axios from 'axios'
import { logSmsDelivery } from './smsStructuredLog.js'

const ALIGO_API_KEY = process.env.ALIGO_API_KEY
const ALIGO_USER_ID = process.env.ALIGO_USER_ID
const ALIGO_SENDER = process.env.ALIGO_SENDER
const ALIGO_TEST_MODE = String(process.env.ALIGO_TEST_MODE ?? 'Y').trim().toUpperCase() || 'Y'

/** 설정 시 JSON `{ phone, message }` POST로 전송 (예: EC2 중계 서버). Aligo·테스트모드보다 우선 */
const SMS_HTTP_GATEWAY_URL = String(process.env.SMS_HTTP_GATEWAY_URL ?? '').trim()

const ALIGO_URL = 'https://apis.aligo.in/send/'

const IS_PRODUCTION =
  process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT)

/** 3~5초 권장 — env로 덮어쓰기 가능 */
const SMS_SEND_TIMEOUT_MS = (() => {
  const n = Number(process.env.SMS_SEND_TIMEOUT_MS ?? 5000)
  if (!Number.isFinite(n) || n < 3000) {
    return 5000
  }
  return Math.min(n, 8000)
})()

const RETRY_DELAY_MS = 400

function maskPhone(phoneDigits) {
  const d = String(phoneDigits ?? '').replace(/\D/g, '')
  if (d.length < 4) {
    return '***'
  }
  return `***${d.slice(-4)}`
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export function isSmsProviderConfigured() {
  if (SMS_HTTP_GATEWAY_URL) {
    return true
  }
  return Boolean(
    String(ALIGO_API_KEY ?? '').trim() &&
      String(ALIGO_USER_ID ?? '').trim() &&
      String(ALIGO_SENDER ?? '').trim(),
  )
}

/**
 * @param {{ phoneNumber: string, code: string, purpose: string, clientIp?: string }} params
 * @returns {Promise<{ success: boolean, sent?: boolean, test?: boolean, data?: unknown, error?: unknown }>}
 */
export async function sendVerificationCode({ phoneNumber, code, purpose, clientIp = '' }) {
  const receiver = String(phoneNumber ?? '').replace(/[^0-9]/g, '')
  const purposeNorm = String(purpose ?? '')
  const messageGateway = `인증번호는 ${code} 입니다.`
  const messageAligo = `[인증번호] ${code} (3분 이내 입력해주세요)`
  const ip = String(clientIp ?? '').trim()

  const finalizeFail = (status, channel) => {
    logSmsDelivery({
      phone: receiver,
      ip,
      status,
      purpose: purposeNorm,
      channel,
    })
  }
  const finalizeOk = (channel) => {
    logSmsDelivery({
      phone: receiver,
      ip,
      status: 'ok',
      purpose: purposeNorm,
      channel,
    })
  }

  if (SMS_HTTP_GATEWAY_URL) {
    const runOnce = () =>
      axios.post(
        SMS_HTTP_GATEWAY_URL,
        { phone: receiver, message: messageGateway },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: SMS_SEND_TIMEOUT_MS,
          validateStatus: () => true,
        },
      )

    let response
    try {
      response = await runOnce()
    } catch (err) {
      await sleep(RETRY_DELAY_MS)
      try {
        response = await runOnce()
      } catch (err2) {
        finalizeFail('gateway_error', 'http')
        return { success: false, sent: false, error: err2 }
      }
    }

    if (response.status >= 200 && response.status < 300) {
      finalizeOk('http')
      return { success: true, sent: true, data: response.data }
    }

    await sleep(RETRY_DELAY_MS)
    try {
      response = await runOnce()
    } catch (err) {
      finalizeFail('gateway_error', 'http')
      return { success: false, sent: false, error: err }
    }

    if (response.status >= 200 && response.status < 300) {
      finalizeOk('http_retry')
      return { success: true, sent: true, data: response.data }
    }

    finalizeFail('gateway_reject', 'http')
    return { success: false, sent: false, data: response.data }
  }

  if (ALIGO_TEST_MODE === 'Y') {
    finalizeOk('test_mode')
    if (IS_PRODUCTION) {
      console.log('[SMS TEST MODE] production — not sent', {
        to: maskPhone(receiver),
        purpose: purposeNorm,
      })
    } else {
      console.log('[SMS TEST MODE] not sent', { to: maskPhone(receiver), purpose: purposeNorm })
    }
    return { success: true, test: true, sent: true }
  }

  if (!isSmsProviderConfigured()) {
    finalizeFail('provider_unconfigured', 'aligo')
    console.warn('[smsService] SMS provider not configured (gateway URL or Aligo env)')
    return { success: false, sent: false }
  }

  const runAligo = () => {
    const body = new URLSearchParams({
      key: String(ALIGO_API_KEY),
      user_id: String(ALIGO_USER_ID),
      sender: String(ALIGO_SENDER),
      receiver,
      msg: messageAligo,
      testmode_yn: ALIGO_TEST_MODE,
    })
    return axios.post(ALIGO_URL, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      maxBodyLength: Infinity,
      timeout: SMS_SEND_TIMEOUT_MS,
    })
  }

  const fetchAligoData = async () => {
    const response = await runAligo()
    return response.data
  }

  try {
    let data = await fetchAligoData()
    if (String(data?.result_code) !== '1') {
      await sleep(RETRY_DELAY_MS)
      data = await fetchAligoData()
    }
    if (String(data?.result_code) !== '1') {
      finalizeFail('aligo_reject', 'aligo')
      console.error('[smsService] SMS send failed:', {
        result_code: data?.result_code,
        purpose: purposeNorm,
        to: maskPhone(receiver),
      })
      return { success: false, sent: false, data }
    }
    finalizeOk('aligo')
    return { success: true, sent: true, data }
  } catch (error) {
    try {
      await sleep(RETRY_DELAY_MS)
      const data = await fetchAligoData()
      if (String(data?.result_code) === '1') {
        finalizeOk('aligo_retry')
        return { success: true, sent: true, data }
      }
      finalizeFail('aligo_reject', 'aligo')
      return { success: false, sent: false, data }
    } catch (err2) {
      finalizeFail('aligo_error', 'aligo')
      const msg = err2 instanceof Error ? err2.message : String(err2)
      console.error('[smsService] SMS API error:', msg)
      return { success: false, sent: false, error: err2 }
    }
  }
}
