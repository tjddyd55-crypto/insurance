const ALIGO_SEND_URL = 'https://apis.aligo.in/send/'
const ALIGO_REMAIN_URL = 'https://apis.aligo.in/remain/'

const SEND_TIMEOUT_MS = (() => {
  const n = Number(process.env.CRM_SMS_ALIGO_TIMEOUT_MS ?? 8000)
  return Number.isFinite(n) && n >= 3000 ? Math.min(n, 15000) : 8000
})()

function parseAligoResult(data) {
  const code = Number(data?.result_code ?? data?.code ?? -999)
  const message = String(data?.message ?? data?.msg ?? '').trim()
  const ok = Number.isFinite(code) && code >= 0
  const msgId = data?.msg_id != null ? String(data.msg_id) : data?.mid != null ? String(data.mid) : undefined
  return { ok, code, message, msgId }
}

function classifyError({ message = '', network = false, httpStatus = 0 } = {}) {
  if (httpStatus === 401) {
    return { errorCode: 'gateway_auth_error', errorMessage: 'Gateway 인증에 실패했습니다.' }
  }
  if (network) {
    return {
      errorCode: 'network_error',
      errorMessage: '알리고 서버와 통신하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    }
  }
  const lower = String(message).toLowerCase()
  if (/api\s*key|인증|permission|unauthorized/.test(message) || /key|auth/.test(lower)) {
    return { errorCode: 'invalid_api_key', errorMessage: '알리고 API Key 또는 계정 정보를 확인해 주세요.' }
  }
  if (/발신|sender|등록/.test(message)) {
    return { errorCode: 'sender_not_registered', errorMessage: '발신번호가 알리고에 등록되어 있는지 확인해 주세요.' }
  }
  if (/잔액|포인트|부족|remain|balance/.test(message) || /remain|balance/.test(lower)) {
    return {
      errorCode: 'insufficient_balance',
      errorMessage: '알리고 계정 잔액/잔여건수가 부족합니다. 알리고 사이트에서 충전해 주세요.',
    }
  }
  if (/수신|receiver|휴대|phone/.test(message)) {
    return { errorCode: 'invalid_receiver', errorMessage: '수신번호 형식을 확인해 주세요.' }
  }
  return {
    errorCode: 'provider_error',
    errorMessage: message || '알리고 처리 중 오류가 발생했습니다.',
  }
}

function sanitizeRaw(raw) {
  if (raw == null || typeof raw !== 'object') {
    return raw
  }
  const clone = { ...raw }
  for (const key of ['key', 'api_key', 'apiKey', 'user_id', 'userid', 'sender', 'receiver', 'msg']) {
    if (key in clone) {
      clone[key] = '****'
    }
  }
  return clone
}

function formatScheduled(input) {
  const raw = input?.scheduled_at ?? input?.scheduledAt
  if (!raw) {
    return { rdate: '', rtime: '' }
  }
  const dt = raw instanceof Date ? raw : new Date(raw)
  if (Number.isNaN(dt.getTime())) {
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

function resolveMessageType(message, explicit) {
  const type = String(explicit ?? '').trim().toUpperCase()
  if (type === 'SMS' || type === 'LMS' || type === 'MMS') {
    return type
  }
  const bytes = Buffer.byteLength(String(message ?? ''), 'utf8')
  return bytes > 90 ? 'LMS' : 'SMS'
}

async function postForm(url, params) {
  const body = params.toString()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    })
    const data = await res.json().catch(() => ({}))
    return { data, httpStatus: res.status }
  } catch {
    return { data: null, httpStatus: 0, network: true }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {Record<string, unknown>} payload
 */
export async function sendViaAligo(payload) {
  const msgType = resolveMessageType(payload.message, payload.message_type ?? payload.messageType)
  const { rdate, rtime } = formatScheduled(payload)
  const params = new URLSearchParams()
  params.set('key', String(payload.api_key ?? payload.apiKey ?? ''))
  params.set('user_id', String(payload.user_id ?? payload.userId ?? ''))
  params.set('sender', String(payload.sender ?? ''))
  params.set('receiver', String(payload.receiver ?? ''))
  params.set('msg', String(payload.message ?? ''))
  params.set('msg_type', msgType)
  const testmode = String(payload.testmode_yn ?? payload.testmodeYn ?? 'N').trim().toUpperCase()
  if (testmode === 'Y') {
    params.set('testmode_yn', 'Y')
  }
  if (rdate && rtime) {
    params.set('rdate', rdate)
    params.set('rtime', rtime)
  }

  const started = Date.now()
  const { data, httpStatus, network } = await postForm(ALIGO_SEND_URL, params)
  if (network || !data) {
    const classified = classifyError({ network: true })
    return {
      success: false,
      providerMessageId: null,
      errorCode: classified.errorCode,
      errorMessage: classified.errorMessage,
      raw: sanitizeRaw({ network_error: true }),
      durationMs: Date.now() - started,
      testMode: testmode === 'Y',
    }
  }

  const parsed = parseAligoResult(data)
  if (!parsed.ok) {
    const classified = classifyError({ message: parsed.message })
    return {
      success: false,
      providerMessageId: null,
      errorCode: classified.errorCode,
      errorMessage: classified.errorMessage,
      raw: sanitizeRaw(data),
      durationMs: Date.now() - started,
      testMode: testmode === 'Y',
    }
  }

  return {
    success: true,
    providerMessageId: parsed.msgId ?? null,
    errorCode: null,
    errorMessage: null,
    raw: sanitizeRaw(data),
    durationMs: Date.now() - started,
    testMode: testmode === 'Y',
  }
}

/**
 * @param {Record<string, unknown>} payload
 */
export async function balanceViaAligo(payload) {
  const params = new URLSearchParams()
  params.set('key', String(payload.api_key ?? payload.apiKey ?? ''))
  params.set('user_id', String(payload.user_id ?? payload.userId ?? ''))

  const started = Date.now()
  const { data, network } = await postForm(ALIGO_REMAIN_URL, params)
  if (network || !data) {
    const classified = classifyError({ network: true })
    return {
      success: false,
      balanceText: null,
      errorCode: classified.errorCode,
      errorMessage: `${classified.errorMessage} API Key, 서버 IP 등록, 알리고 계정 상태를 확인해 주세요.`,
      raw: sanitizeRaw({ network_error: true }),
      durationMs: Date.now() - started,
    }
  }

  const parsed = parseAligoResult(data)
  if (!parsed.ok) {
    const classified = classifyError({ message: parsed.message })
    return {
      success: false,
      balanceText: null,
      errorCode: classified.errorCode,
      errorMessage: `${classified.errorMessage} API Key, 서버 IP 등록, 알리고 계정 상태를 확인해 주세요.`,
      raw: sanitizeRaw(data),
      durationMs: Date.now() - started,
    }
  }

  const smsCnt = data?.SMS_CNT ?? data?.sms_cnt
  const lmsCnt = data?.LMS_CNT ?? data?.lms_cnt
  const mmsCnt = data?.MMS_CNT ?? data?.mms_cnt
  return {
    success: true,
    balanceText: `SMS ${smsCnt ?? '-'}건 / LMS ${lmsCnt ?? '-'}건 / MMS ${mmsCnt ?? '-'}건`,
    errorCode: null,
    errorMessage: null,
    raw: sanitizeRaw(data),
    durationMs: Date.now() - started,
  }
}
