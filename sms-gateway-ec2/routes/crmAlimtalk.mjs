import express from 'express'
import {
  historyDetailViaAligo,
  historyListViaAligo,
  profileListViaAligo,
  sendAlimtalkViaAligo,
} from '../lib/aligoKakaoClient.mjs'
import { logCrmGatewayEvent } from '../lib/crmGatewayLog.mjs'

function readBearerToken(req) {
  const header = String(req.headers.authorization ?? '').trim()
  if (!header.toLowerCase().startsWith('bearer ')) return ''
  return header.slice(7).trim()
}

function crmAlimtalkAuth(req, res, next) {
  const expected = String(
    process.env.CRM_ALIMTALK_GATEWAY_TOKEN ??
      process.env.CRM_SMS_GATEWAY_TOKEN ??
      process.env.SMS_MODULE_GATEWAY_TOKEN ??
      '',
  ).trim()
  if (!expected) {
    res.status(503).json({
      success: false,
      providerCode: null,
      providerMessage: 'CRM Alimtalk Gateway token is not configured.',
      providerMessageId: null,
      info: null,
      raw: {},
    })
    return
  }
  const token = readBearerToken(req)
  if (!token || token !== expected) {
    res.status(401).json({
      success: false,
      providerCode: null,
      providerMessage: 'Gateway 인증에 실패했습니다.',
      providerMessageId: null,
      info: null,
      raw: {},
    })
    return
  }
  next()
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

function maskReceiver(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length < 7) return '***'
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`
}

export function createCrmAlimtalkRouter() {
  const router = express.Router()
  router.use(crmAlimtalkAuth)

  router.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'crm-alimtalk-gateway',
      outboundIpHint: process.env.SMS_MODULE_OUTBOUND_IP_HINT || process.env.OUTBOUND_IP_HINT || null,
    })
  })

  router.post('/send', async (req, res) => {
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
    logCrmGatewayEvent({
      requestId: req.body?.request_id,
      provider: 'aligo_alimtalk',
      sender: req.body?.sender,
      receiver: req.body?.receiver_1 ?? req.body?.receiver,
      success: result.success,
      errorCode: result.providerCode,
      durationMs: result.durationMs,
    })

    // 안전한 운영 로그 (credentials / 수신번호 원문 / Authorization 금지)
    console.info('[crm-alimtalk] send result', {
      tplCode: String(req.body?.tpl_code ?? req.body?.tplCode ?? ''),
      via: 'aligo',
      httpStatus: result.httpStatus,
      providerCode: result.providerCode,
      providerMessage: result.providerMessage,
      providerMessageId: result.providerMessageId,
      info: result.info,
      receiverMasked: maskReceiver(req.body?.receiver_1 ?? req.body?.receiver),
      testMode: result.testMode,
      failover: String(req.body?.failover ?? 'N'),
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

  router.post('/profile-list', async (req, res) => {
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

  router.post('/history-list', async (req, res) => {
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

  router.post('/history-detail', async (req, res) => {
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

  return router
}
