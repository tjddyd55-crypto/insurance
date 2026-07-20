/**
 * Additive CRM alimtalk relay for live sms-server (CommonJS).
 * Mount: require('./crmAlimtalkRoutes').mount(app, { requireGatewayAuth })
 *
 * Railway → POST /api/crm-alimtalk/send | profile-list (Bearer CRM_SMS_GATEWAY_TOKEN)
 * → Aligo kakaoapi from EC2 allowlisted IP.
 * Credentials are passed in the request body (same pattern as /api/crm-sms).
 */
'use strict'

const ALIGO_ALIMTALK_SEND_URL = 'https://kakaoapi.aligo.in/akv10/alimtalk/send/'
const ALIGO_ALIMTALK_PROFILE_LIST_URL = 'https://kakaoapi.aligo.in/akv10/profile/list/'

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
  const button = payload.button_1 ?? payload.buttonPayload
  params.set('button_1', typeof button === 'string' ? button : JSON.stringify(button ?? { button: [] }))
  params.set('failover', String(payload.failover ?? 'N'))
  params.set('testMode', String(payload.testMode ?? 'N'))

  const { data, httpStatus, network } = await postForm(ALIGO_ALIMTALK_SEND_URL, params, timeoutMs())
  if (network || !data) {
    return {
      success: false,
      providerCode: null,
      providerMessage: 'network error',
      providerMessageId: null,
      httpStatus: null,
      raw: sanitizeRaw({ network_error: true }),
      durationMs: Date.now() - started,
    }
  }

  const providerCode = pickCode(data)
  return {
    success: providerCode === 0,
    providerCode,
    providerMessage: pickMessage(data) || 'aligo response',
    providerMessageId: pickMid(data),
    httpStatus,
    raw: sanitizeRaw(data),
    durationMs: Date.now() - started,
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
        raw: {},
      })
      return
    }

    const result = await sendAlimtalkViaAligo(req.body)
    console.log('[crm-alimtalk] send', {
      request_id: req.body?.request_id ?? null,
      tpl_code: String(req.body?.tpl_code ?? req.body?.tplCode ?? '').trim() || null,
      success: result.success,
      providerCode: result.providerCode,
      durationMs: result.durationMs,
    })

    res.status(result.success ? 200 : 502).json({
      success: result.success,
      providerCode: result.providerCode,
      providerMessage: result.providerMessage,
      providerMessageId: result.providerMessageId,
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
}

module.exports = { mount }
