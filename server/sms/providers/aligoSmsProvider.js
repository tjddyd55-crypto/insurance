import axios from 'axios'
import { sanitizeProviderRaw } from '../smsCredentialsCrypto.js'
import { isAligoTestModeEnabled } from '../smsModuleConfig.js'
import { classifyAligoProviderError, maskAligoRequestBodyForLog } from '../smsProviderErrors.js'
import { resolveMessageType } from '../smsMessageUtils.js'

const ALIGO_SEND_URL = 'https://apis.aligo.in/send/'
const ALIGO_REMAIN_URL = 'https://apis.aligo.in/remain/'

const SEND_TIMEOUT_MS = (() => {
  const n = Number(process.env.SMS_MODULE_SEND_TIMEOUT_MS ?? 8000)
  return Number.isFinite(n) && n >= 3000 ? Math.min(n, 15000) : 8000
})()

function formatScheduled(input) {
  const dt = input.scheduledAt instanceof Date ? input.scheduledAt : null
  if (!dt || Number.isNaN(dt.getTime())) {
    return { rdate: '', rtime: '' }
  }
  const kst = new Date(dt.getTime() + 9 * 60 * 60 * 1000)
  const y = kst.getUTCFullYear()
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kst.getUTCDate()).padStart(2, '0')
  const hh = String(kst.getUTCHours()).padStart(2, '0')
  const mm = String(kst.getUTCMinutes()).padStart(2, '0')
  return { rdate: `${y}${m}${d}`, rtime: `${hh}${mm}` }
}

function parseAligoResult(data) {
  const code = Number(data?.result_code ?? data?.code ?? -999)
  const message = String(data?.message ?? data?.msg ?? '').trim()
  const ok = Number.isFinite(code) && code >= 0
  const msgId = data?.msg_id != null ? String(data.msg_id) : data?.mid != null ? String(data.mid) : undefined
  return { ok, code, message, msgId }
}

/** @type {import('./smsProvider.js').SmsProvider} */
export const aligoSmsProvider = {
  async send(input) {
    const msgType = input.messageType ?? resolveMessageType(input.message)
    const { rdate, rtime } = formatScheduled(input)
    const testMode = isAligoTestModeEnabled()
    const params = new URLSearchParams()
    params.set('key', String(input.apiKey ?? ''))
    params.set('user_id', String(input.providerUserId ?? ''))
    params.set('sender', String(input.from ?? ''))
    params.set('receiver', String(input.to ?? ''))
    params.set('msg', String(input.message ?? ''))
    params.set('msg_type', msgType)
    if (msgType === 'LMS' && input.title) {
      params.set('title', String(input.title))
    }
    if (rdate && rtime) {
      params.set('rdate', rdate)
      params.set('rtime', rtime)
    }
    if (testMode) {
      params.set('testmode_yn', 'Y')
    }

    const body = params.toString()
    try {
      const res = await axios.post(ALIGO_SEND_URL, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: SEND_TIMEOUT_MS,
        validateStatus: () => true,
      })
      const parsed = parseAligoResult(res.data)
      if (!parsed.ok) {
        const classified = classifyAligoProviderError({ message: parsed.message, resultCode: parsed.code })
        return {
          success: false,
          errorMessage: classified.publicMessage,
          errorCode: classified.code,
          raw: sanitizeProviderRaw(res.data),
          testMode,
        }
      }
      return {
        success: true,
        providerMessageId: parsed.msgId,
        raw: sanitizeProviderRaw(res.data),
        testMode,
      }
    } catch (err) {
      const classified = classifyAligoProviderError({ network: true })
      if (process.env.NODE_ENV !== 'test') {
        console.error('[sms-module][aligo] send network error', maskAligoRequestBodyForLog(body))
      }
      return {
        success: false,
        errorMessage: classified.publicMessage,
        errorCode: classified.code,
        raw: sanitizeProviderRaw({ network_error: true }),
        testMode,
      }
    }
  },

  async getBalance(input) {
    const params = new URLSearchParams()
    params.set('key', String(input.apiKey ?? ''))
    params.set('user_id', String(input.providerUserId ?? ''))
    const body = params.toString()

    try {
      const res = await axios.post(ALIGO_REMAIN_URL, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: SEND_TIMEOUT_MS,
        validateStatus: () => true,
      })
      const parsed = parseAligoResult(res.data)
      if (!parsed.ok) {
        const classified = classifyAligoProviderError({ message: parsed.message, resultCode: parsed.code })
        return {
          success: false,
          errorMessage: `${classified.publicMessage} API Key, 서버 IP 등록, 알리고 계정 상태를 확인해 주세요.`,
          errorCode: classified.code,
          raw: sanitizeProviderRaw(res.data),
        }
      }
      const smsCnt = res.data?.SMS_CNT ?? res.data?.sms_cnt
      const lmsCnt = res.data?.LMS_CNT ?? res.data?.lms_cnt
      const mmsCnt = res.data?.MMS_CNT ?? res.data?.mms_cnt
      const balanceText = `SMS ${smsCnt ?? '-'}건 / LMS ${lmsCnt ?? '-'}건 / MMS ${mmsCnt ?? '-'}건`
      return { success: true, balanceText, raw: sanitizeProviderRaw(res.data) }
    } catch (err) {
      const classified = classifyAligoProviderError({ network: true })
      if (process.env.NODE_ENV !== 'test') {
        console.error('[sms-module][aligo] balance network error', maskAligoRequestBodyForLog(body))
      }
      return {
        success: false,
        errorMessage: `${classified.publicMessage} API Key, 서버 IP 등록, 알리고 계정 상태를 확인해 주세요.`,
        errorCode: classified.code,
        raw: sanitizeProviderRaw({ network_error: true }),
      }
    }
  },
}
