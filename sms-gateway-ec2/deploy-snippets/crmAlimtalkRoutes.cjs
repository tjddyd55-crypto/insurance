/**
 * Additive CRM alimtalk relay for live sms-server (CommonJS).
 * Mount: require('./crmAlimtalkRoutes').mount(app, { requireGatewayAuth })
 *
 * Railway → POST /api/crm-alimtalk/send | profile-list | template-list | history-* (Bearer)
 * → Aligo kakaoapi from EC2 allowlisted IP.
 * Credentials are passed in the request body (same pattern as /api/crm-sms).
 *
 * 국가지원사업 /send-alimtalk 과 동일한 Aligo form-urlencoded 직렬화:
 * - button_1 = JSON.stringify(once)
 * - failover = N
 * - testMode = Y|N (boolean/false → N)
 * - response: code/message/info (+ providerMessageId = info.mid)
 */
'use strict'

const ALIGO_ALIMTALK_SEND_URL = 'https://kakaoapi.aligo.in/akv10/alimtalk/send/'
const ALIGO_ALIMTALK_PROFILE_LIST_URL = 'https://kakaoapi.aligo.in/akv10/profile/list/'
const ALIGO_ALIMTALK_TEMPLATE_LIST_URL = 'https://kakaoapi.aligo.in/akv10/template/list/'
const ALIGO_ALIMTALK_HISTORY_LIST_URL = 'https://kakaoapi.aligo.in/akv10/history/list/'
const ALIGO_ALIMTALK_HISTORY_DETAIL_URL = 'https://kakaoapi.aligo.in/akv10/history/detail/'

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

/** 국가지원사업과 동일: false/"false"/0 → N, true/"true"/Y → Y */
function normalizeTestMode(raw) {
  if (raw === true) return 'Y'
  if (raw === false || raw == null) return 'N'
  const s = String(raw).trim().toUpperCase()
  if (s === 'Y' || s === '1' || s === 'TRUE' || s === 'YES' || s === 'ON' || s === 'T') return 'Y'
  return 'N'
}

function maskReceiver(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length < 7) return '***'
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`
}

async function postForm(url, params, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
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

function timeoutMs() {
  const n = Number(process.env.CRM_ALIMTALK_TIMEOUT_MS ?? 8000)
  return Number.isFinite(n) && n >= 3000 ? Math.min(n, 15000) : 8000
}

async function sendAlimtalkViaAligo(payload) {
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

  const { data, httpStatus, network } = await postForm(ALIGO_ALIMTALK_SEND_URL, params, timeoutMs())
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
  return {
    success: providerCode === 0,
    providerCode,
    providerMessage: pickMessage(data) || 'aligo response',
    providerMessageId: pickMid(data),
    info: pickInfo(data),
    httpStatus,
    raw: sanitizeRaw(data),
    durationMs: Date.now() - started,
    testMode,
  }
}

async function profileListViaAligo(payload) {
  const started = Date.now()
  const params = new URLSearchParams()
  params.set('apikey', String(payload.apikey ?? payload.apiKey ?? ''))
  params.set('userid', String(payload.userid ?? payload.userId ?? ''))
  const { data, httpStatus, network } = await postForm(
    ALIGO_ALIMTALK_PROFILE_LIST_URL,
    params,
    timeoutMs(),
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
    list: Array.isArray(data.list) ? data.list : [],
    httpStatus,
    raw: sanitizeRaw(data),
    durationMs: Date.now() - started,
  }
}

async function templateListViaAligo(payload) {
  const started = Date.now()
  const params = new URLSearchParams()
  params.set('apikey', String(payload.apikey ?? payload.apiKey ?? ''))
  params.set('userid', String(payload.userid ?? payload.userId ?? ''))
  params.set('senderkey', String(payload.senderkey ?? payload.senderKey ?? ''))
  const tplCode = String(payload.tpl_code ?? payload.tplCode ?? '').trim()
  if (tplCode) params.set('tpl_code', tplCode)
  const { data, httpStatus, network } = await postForm(
    ALIGO_ALIMTALK_TEMPLATE_LIST_URL,
    params,
    timeoutMs(),
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
    list: Array.isArray(data.list) ? data.list : [],
    httpStatus,
    raw: sanitizeRaw(data),
    durationMs: Date.now() - started,
  }
}

async function historyListViaAligo(payload) {
  const started = Date.now()
  const params = new URLSearchParams()
  params.set('apikey', String(payload.apikey ?? payload.apiKey ?? ''))
  params.set('userid', String(payload.userid ?? payload.userId ?? ''))
  if (payload.startdate) params.set('startdate', String(payload.startdate))
  if (payload.enddate) params.set('enddate', String(payload.enddate))
  if (payload.page) params.set('page', String(payload.page))
  if (payload.limit) params.set('limit', String(payload.limit))
  const { data, httpStatus, network } = await postForm(
    ALIGO_ALIMTALK_HISTORY_LIST_URL,
    params,
    timeoutMs(),
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
    list: Array.isArray(data.list) ? data.list : [],
    httpStatus,
    raw: sanitizeRaw(data),
    durationMs: Date.now() - started,
  }
}

async function historyDetailViaAligo(payload) {
  const started = Date.now()
  const params = new URLSearchParams()
  params.set('apikey', String(payload.apikey ?? payload.apiKey ?? ''))
  params.set('userid', String(payload.userid ?? payload.userId ?? ''))
  params.set('mid', String(payload.mid ?? ''))
  const { data, httpStatus, network } = await postForm(
    ALIGO_ALIMTALK_HISTORY_DETAIL_URL,
    params,
    timeoutMs(),
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
    list: Array.isArray(data.list) ? data.list : [],
    httpStatus,
    raw: sanitizeRaw(data),
    durationMs: Date.now() - started,
  }
}

function validateSendPayload(body) {
  const apikey = String(body?.apikey ?? body?.apiKey ?? '').trim()
  const userid = String(body?.userid ?? body?.userId ?? '').trim()
  const senderkey = String(body?.senderkey ?? body?.senderKey ?? '').trim()
  const sender = String(body?.sender ?? '').trim()
  const tplCode = String(body?.tpl_code ?? body?.tplCode ?? '').trim()
  const receiver = String(body?.receiver_1 ?? body?.receiver ?? '').trim()
  const message = String(body?.message_1 ?? body?.message ?? '')
  if (!apikey || !userid || !senderkey || !sender || !tplCode || !receiver || !message) {
    return {
      ok: false,
      message: 'apikey, userid, senderkey, sender, tpl_code, receiver_1, message_1 are required',
    }
  }
  return { ok: true }
}

/**
 * @param {import('express').Express} app
 * @param {{ requireGatewayAuth: import('express').RequestHandler }} opts
 */
function mount(app, opts) {
  const requireGatewayAuth = opts.requireGatewayAuth

  app.get('/api/crm-alimtalk/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'crm-alimtalk-gateway',
      outboundIpHint: process.env.SMS_MODULE_OUTBOUND_IP_HINT || '100.54.92.161',
    })
  })

  app.post('/api/crm-alimtalk/send', requireGatewayAuth, async (req, res) => {
    const validation = validateSendPayload(req.body)
    if (!validation.ok) {
      res.status(400).json({
        success: false,
        providerCode: null,
        providerMessage: validation.message,
        providerMessageId: null,
        info: null,
        raw: {},
      })
      return
    }

    const result = await sendAlimtalkViaAligo(req.body)
    console.info('[crm-alimtalk] send result', {
      tplCode: String(req.body?.tpl_code ?? req.body?.tplCode ?? '').trim() || null,
      success: result.success,
      providerCode: result.providerCode,
      providerMessage: result.providerMessage,
      providerMessageId: result.providerMessageId,
      info: result.info,
      receiverMasked: maskReceiver(req.body?.receiver_1 ?? req.body?.receiver),
      testMode: result.testMode,
      failover: String(req.body?.failover ?? 'N'),
      emtitleConfigured: Boolean(String(req.body?.emtitle_1 ?? req.body?.emtitle ?? '').trim()),
      emtitleLength: String(req.body?.emtitle_1 ?? req.body?.emtitle ?? '').trim().length || 0,
      subjectConfigured: Boolean(String(req.body?.subject_1 ?? req.body?.subject ?? '').trim()),
      durationMs: result.durationMs,
    })

    res.status(result.success ? 200 : 502).json({
      success: result.success,
      providerCode: result.providerCode,
      providerMessage: result.providerMessage,
      providerMessageId: result.providerMessageId,
      info: result.info,
      httpStatus: result.httpStatus,
      raw: result.raw,
    })
  })

  app.post('/api/crm-alimtalk/profile-list', requireGatewayAuth, async (req, res) => {
    const apikey = String(req.body?.apikey ?? req.body?.apiKey ?? '').trim()
    const userid = String(req.body?.userid ?? req.body?.userId ?? '').trim()
    if (!apikey || !userid) {
      res.status(400).json({
        success: false,
        providerCode: null,
        providerMessage: 'apikey and userid are required',
        list: [],
        raw: {},
      })
      return
    }
    const result = await profileListViaAligo(req.body)
    res.status(result.success ? 200 : 502).json({
      success: result.success,
      providerCode: result.providerCode,
      providerMessage: result.providerMessage,
      list: result.list,
      httpStatus: result.httpStatus,
      raw: result.raw,
    })
  })

  app.post('/api/crm-alimtalk/template-list', requireGatewayAuth, async (req, res) => {
    const apikey = String(req.body?.apikey ?? req.body?.apiKey ?? '').trim()
    const userid = String(req.body?.userid ?? req.body?.userId ?? '').trim()
    const senderkey = String(req.body?.senderkey ?? req.body?.senderKey ?? '').trim()
    if (!apikey || !userid || !senderkey) {
      res.status(400).json({
        success: false,
        providerCode: null,
        providerMessage: 'apikey, userid, senderkey are required',
        list: [],
        raw: {},
      })
      return
    }
    const result = await templateListViaAligo(req.body)
    res.status(result.success ? 200 : 502).json({
      success: result.success,
      providerCode: result.providerCode,
      providerMessage: result.providerMessage,
      list: result.list,
      httpStatus: result.httpStatus,
      raw: result.raw,
    })
  })

  app.post('/api/crm-alimtalk/history-list', requireGatewayAuth, async (req, res) => {
    const apikey = String(req.body?.apikey ?? req.body?.apiKey ?? '').trim()
    const userid = String(req.body?.userid ?? req.body?.userId ?? '').trim()
    if (!apikey || !userid) {
      res.status(400).json({
        success: false,
        providerCode: null,
        providerMessage: 'apikey and userid are required',
        list: [],
        raw: {},
      })
      return
    }
    const result = await historyListViaAligo(req.body)
    res.status(result.success ? 200 : 502).json({
      success: result.success,
      providerCode: result.providerCode,
      providerMessage: result.providerMessage,
      list: result.list,
      httpStatus: result.httpStatus,
      raw: result.raw,
    })
  })

  app.post('/api/crm-alimtalk/history-detail', requireGatewayAuth, async (req, res) => {
    const apikey = String(req.body?.apikey ?? req.body?.apiKey ?? '').trim()
    const userid = String(req.body?.userid ?? req.body?.userId ?? '').trim()
    const mid = String(req.body?.mid ?? '').trim()
    if (!apikey || !userid || !mid) {
      res.status(400).json({
        success: false,
        providerCode: null,
        providerMessage: 'apikey, userid, mid are required',
        list: [],
        raw: {},
      })
      return
    }
    const result = await historyDetailViaAligo(req.body)
    res.status(result.success ? 200 : 502).json({
      success: result.success,
      providerCode: result.providerCode,
      providerMessage: result.providerMessage,
      list: result.list,
      httpStatus: result.httpStatus,
      raw: result.raw,
    })
  })
}

module.exports = {
  mount,
  normalizeTestMode,
  pickInfo,
  pickMid,
  sendAlimtalkViaAligo,
}
