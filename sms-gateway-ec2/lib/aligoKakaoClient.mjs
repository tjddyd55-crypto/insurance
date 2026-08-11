const ALIGO_ALIMTALK_SEND_URL = 'https://kakaoapi.aligo.in/akv10/alimtalk/send/'
const ALIGO_ALIMTALK_PROFILE_LIST_URL = 'https://kakaoapi.aligo.in/akv10/profile/list/'
const ALIGO_ALIMTALK_TEMPLATE_LIST_URL = 'https://kakaoapi.aligo.in/akv10/template/list/'

const SEND_TIMEOUT_MS = (() => {
  const n = Number(process.env.CRM_ALIMTALK_TIMEOUT_MS ?? 8000)
  return Number.isFinite(n) && n >= 3000 ? Math.min(n, 15000) : 8000
})()

function sanitizeRaw(raw) {
  if (raw == null || typeof raw !== 'object') return raw
  const clone = { ...raw }
  for (const key of [
    'apikey',
    'api_key',
    'apiKey',
    'userid',
    'user_id',
    'userId',
    'senderkey',
    'senderKey',
    'sender',
    'receiver_1',
    'receiver',
    'message_1',
    'button_1',
  ]) {
    if (key in clone) clone[key] = '****'
  }
  return clone
}

async function postForm(url, params) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    })
    const text = await res.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = { message: String(text).slice(0, 300) }
    }
    return { data, httpStatus: res.status }
  } catch {
    return { data: null, httpStatus: 0, network: true }
  } finally {
    clearTimeout(timer)
  }
}

function pickCode(raw) {
  if (!raw || typeof raw !== 'object') return null
  const code = raw.code ?? raw.result_code ?? raw.resultCode
  if (code == null || code === '') return null
  const n = Number(code)
  return Number.isFinite(n) ? n : null
}

function pickMessage(raw) {
  if (!raw || typeof raw !== 'object') return null
  const msg = raw.message ?? raw.msg ?? raw.result_message
  return msg != null ? String(msg).slice(0, 300) : null
}

function pickMid(raw) {
  if (!raw || typeof raw !== 'object') return null
  const info = raw.info && typeof raw.info === 'object' ? raw.info : null
  const id = (info && info.mid) || raw.mid || raw.message_id || raw.msg_id
  return id != null ? String(id) : null
}

function pickInfo(raw) {
  if (!raw || typeof raw !== 'object' || !raw.info || typeof raw.info !== 'object') return null
  const info = raw.info
  return {
    mid: info.mid != null ? String(info.mid) : null,
    type: info.type != null ? String(info.type) : null,
    scnt: info.scnt != null ? Number(info.scnt) : null,
    fcnt: info.fcnt != null ? Number(info.fcnt) : null,
    pcnt: info.pcnt != null ? Number(info.pcnt) : null,
    total: info.total != null ? Number(info.total) : null,
    unit: info.unit != null ? Number(info.unit) : null,
  }
}

/** 국가지원사업 EC2 와 동일: false/"false" → N */
function normalizeTestMode(raw) {
  if (raw === true) return 'Y'
  if (raw === false || raw == null) return 'N'
  const s = String(raw).trim().toUpperCase()
  if (s === 'Y' || s === '1' || s === 'TRUE' || s === 'YES' || s === 'ON' || s === 'T') return 'Y'
  return 'N'
}

/**
 * Relay Aligo Kakao alimtalk/send from EC2 (IP-whitelisted).
 * Credentials are passed from Railway in the request body (same pattern as CRM SMS).
 * @param {Record<string, unknown>} payload
 */
export async function sendAlimtalkViaAligo(payload) {
  const started = Date.now()
  const params = new URLSearchParams()
  params.set('apikey', String(payload.apikey ?? payload.apiKey ?? ''))
  params.set('userid', String(payload.userid ?? payload.userId ?? ''))
  params.set('senderkey', String(payload.senderkey ?? payload.senderKey ?? ''))
  params.set('tpl_code', String(payload.tpl_code ?? payload.tplCode ?? ''))
  params.set('sender', String(payload.sender ?? '').replace(/\D/g, ''))
  params.set('receiver_1', String(payload.receiver_1 ?? payload.receiver ?? '').replace(/\D/g, ''))
  params.set('recvname_1', String(payload.recvname_1 ?? payload.recvName ?? '고객').trim() || '고객')
  params.set('subject_1', String(payload.subject_1 ?? payload.subject ?? '').trim())
  params.set('message_1', String(payload.message_1 ?? payload.message ?? ''))
  const emtitle = String(payload.emtitle_1 ?? payload.emtitle ?? '').trim()
  if (emtitle) {
    params.set('emtitle_1', emtitle)
  }
  const button = payload.button_1 ?? payload.buttonPayload
  params.set('button_1', typeof button === 'string' ? button : JSON.stringify(button ?? { button: [] }))
  params.set('failover', String(payload.failover ?? 'N'))
  const testMode = normalizeTestMode(payload.testMode)
  params.set('testMode', testMode)

  const { data, httpStatus, network } = await postForm(ALIGO_ALIMTALK_SEND_URL, params)
  if (network || !data) {
    return {
      success: false,
      providerCode: null,
      providerMessage: 'network error',
      providerMessageId: null,
      info: null,
      httpStatus: null,
      raw: sanitizeRaw({ network_error: true }),
      durationMs: Date.now() - started,
      testMode,
    }
  }

  const providerCode = pickCode(data)
  const providerMessage = pickMessage(data) || 'aligo response'
  const providerMessageId = pickMid(data)
  const info = pickInfo(data)
  const ok = providerCode === 0
  return {
    success: ok,
    providerCode,
    providerMessage,
    providerMessageId,
    info,
    httpStatus,
    raw: sanitizeRaw(data),
    durationMs: Date.now() - started,
    testMode,
  }
}

/**
 * @param {Record<string, unknown>} payload
 */
export async function profileListViaAligo(payload) {
  const started = Date.now()
  const params = new URLSearchParams()
  params.set('apikey', String(payload.apikey ?? payload.apiKey ?? ''))
  params.set('userid', String(payload.userid ?? payload.userId ?? ''))
  const { data, httpStatus, network } = await postForm(ALIGO_ALIMTALK_PROFILE_LIST_URL, params)
  if (network || !data) {
    return {
      success: false,
      providerCode: null,
      providerMessage: 'network error',
      list: [],
      httpStatus: null,
      raw: sanitizeRaw({ network_error: true }),
      durationMs: Date.now() - started,
    }
  }
  const providerCode = pickCode(data)
  return {
    success: providerCode === 0,
    providerCode,
    providerMessage: pickMessage(data),
    list: Array.isArray(data?.list) ? data.list : [],
    httpStatus,
    raw: sanitizeRaw(data),
    durationMs: Date.now() - started,
  }
}

/**
 * Aligo kakao template/list — 템플릿 검수상태(inspStatus) 조회.
 * @param {Record<string, unknown>} payload
 */
export async function templateListViaAligo(payload) {
  const started = Date.now()
  const params = new URLSearchParams()
  params.set('apikey', String(payload.apikey ?? payload.apiKey ?? ''))
  params.set('userid', String(payload.userid ?? payload.userId ?? ''))
  params.set('senderkey', String(payload.senderkey ?? payload.senderKey ?? ''))
  const tplCode = String(payload.tpl_code ?? payload.tplCode ?? '').trim()
  if (tplCode) {
    params.set('tpl_code', tplCode)
  }
  const { data, httpStatus, network } = await postForm(ALIGO_ALIMTALK_TEMPLATE_LIST_URL, params)
  if (network || !data) {
    return {
      success: false,
      providerCode: null,
      providerMessage: 'network error',
      list: [],
      httpStatus: null,
      raw: sanitizeRaw({ network_error: true }),
      durationMs: Date.now() - started,
    }
  }
  const providerCode = pickCode(data)
  return {
    success: providerCode === 0,
    providerCode,
    providerMessage: pickMessage(data),
    list: Array.isArray(data?.list) ? data.list : [],
    httpStatus,
    raw: sanitizeRaw(data),
    durationMs: Date.now() - started,
  }
}

/**
 * Aligo kakao history/list — mid 단위 접수 이력 조회 (수신 여부 확인용).
 * @param {Record<string, unknown>} payload
 */
export async function historyListViaAligo(payload) {
  const started = Date.now()
  const params = new URLSearchParams()
  params.set('apikey', String(payload.apikey ?? payload.apiKey ?? ''))
  params.set('userid', String(payload.userid ?? payload.userId ?? ''))
  if (payload.startdate) params.set('startdate', String(payload.startdate))
  if (payload.enddate) params.set('enddate', String(payload.enddate))
  if (payload.page) params.set('page', String(payload.page))
  if (payload.limit) params.set('limit', String(payload.limit))
  const { data, httpStatus, network } = await postForm(
    'https://kakaoapi.aligo.in/akv10/history/list/',
    params,
  )
  if (network || !data) {
    return {
      success: false,
      providerCode: null,
      providerMessage: 'network error',
      list: [],
      httpStatus: null,
      raw: sanitizeRaw({ network_error: true }),
      durationMs: Date.now() - started,
    }
  }
  const providerCode = pickCode(data)
  return {
    success: providerCode === 0,
    providerCode,
    providerMessage: pickMessage(data),
    list: Array.isArray(data?.list) ? data.list : [],
    httpStatus,
    raw: sanitizeRaw(data),
    durationMs: Date.now() - started,
  }
}

/**
 * Aligo kakao history/detail — mid 상세(수신 결과 rslt 등).
 * @param {Record<string, unknown>} payload
 */
export async function historyDetailViaAligo(payload) {
  const started = Date.now()
  const params = new URLSearchParams()
  params.set('apikey', String(payload.apikey ?? payload.apiKey ?? ''))
  params.set('userid', String(payload.userid ?? payload.userId ?? ''))
  params.set('mid', String(payload.mid ?? ''))
  const { data, httpStatus, network } = await postForm(
    'https://kakaoapi.aligo.in/akv10/history/detail/',
    params,
  )
  if (network || !data) {
    return {
      success: false,
      providerCode: null,
      providerMessage: 'network error',
      list: [],
      httpStatus: null,
      raw: sanitizeRaw({ network_error: true }),
      durationMs: Date.now() - started,
    }
  }
  const providerCode = pickCode(data)
  return {
    success: providerCode === 0,
    providerCode,
    providerMessage: pickMessage(data),
    list: Array.isArray(data?.list) ? data.list : [],
    httpStatus,
    raw: sanitizeRaw(data),
    durationMs: Date.now() - started,
  }
}

export { normalizeTestMode }
