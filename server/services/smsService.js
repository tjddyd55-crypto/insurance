import axios from 'axios'

const ALIGO_API_KEY = process.env.ALIGO_API_KEY
const ALIGO_USER_ID = process.env.ALIGO_USER_ID
const ALIGO_SENDER = process.env.ALIGO_SENDER
const ALIGO_TEST_MODE = String(process.env.ALIGO_TEST_MODE ?? 'Y').trim().toUpperCase() || 'Y'

const ALIGO_URL = 'https://apis.aligo.in/send/'

const IS_PRODUCTION =
  process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT)

function maskPhone(phoneDigits) {
  const d = String(phoneDigits ?? '').replace(/\D/g, '')
  if (d.length < 4) {
    return '***'
  }
  return `***${d.slice(-4)}`
}

export function isSmsProviderConfigured() {
  return Boolean(
    String(ALIGO_API_KEY ?? '').trim() &&
      String(ALIGO_USER_ID ?? '').trim() &&
      String(ALIGO_SENDER ?? '').trim(),
  )
}

/**
 * @param {{ phoneNumber: string, code: string, purpose: string }} params
 * @returns {Promise<{ success: boolean, sent?: boolean, test?: boolean, data?: unknown, error?: unknown }>}
 */
export async function sendVerificationCode({ phoneNumber, code, purpose }) {
  const receiver = String(phoneNumber ?? '').replace(/[^0-9]/g, '')
  const purposeNorm = String(purpose ?? '')
  const message = `[인증번호] ${code} (5분 이내 입력해주세요)`

  if (ALIGO_TEST_MODE === 'Y') {
    if (IS_PRODUCTION) {
      console.log('[SMS TEST MODE] production — code not logged', {
        to: maskPhone(receiver),
        purpose: purposeNorm,
      })
    } else {
      console.log('[SMS TEST MODE]')
      console.log('to:', receiver)
      console.log('code:', code)
    }
    return { success: true, test: true, sent: true }
  }

  if (!isSmsProviderConfigured()) {
    console.warn('[smsService] SMS provider not configured (need ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER)')
    return { success: false, sent: false }
  }

  try {
    const body = new URLSearchParams({
      key: String(ALIGO_API_KEY),
      user_id: String(ALIGO_USER_ID),
      sender: String(ALIGO_SENDER),
      receiver,
      msg: message,
      testmode_yn: ALIGO_TEST_MODE,
    })
    const response = await axios.post(ALIGO_URL, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      maxBodyLength: Infinity,
    })

    const data = response.data

    if (String(data?.result_code) !== '1') {
      console.error('[smsService] SMS send failed:', {
        result_code: data?.result_code,
        message: data?.message,
        purpose: purposeNorm,
        to: maskPhone(receiver),
      })
      return { success: false, sent: false, data }
    }

    return { success: true, sent: true, data }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[smsService] SMS API error:', msg)
    return { success: false, sent: false, error }
  }
}
