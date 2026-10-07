import express from 'express'
import { balanceViaAligo, sendViaAligo } from '../lib/aligoClient.mjs'
import { logCrmGatewayEvent } from '../lib/crmGatewayLog.mjs'

function readBearerToken(req) {
  const header = String(req.headers.authorization ?? '').trim()
  if (!header.toLowerCase().startsWith('bearer ')) {
    return ''
  }
  return header.slice(7).trim()
}

function crmGatewayAuth(req, res, next) {
  const expected = String(process.env.CRM_SMS_GATEWAY_TOKEN ?? process.env.SMS_MODULE_GATEWAY_TOKEN ?? '').trim()
  if (!expected) {
    res.status(503).json({
      success: false,
      providerMessageId: null,
      errorCode: 'provider_error',
      errorMessage: 'CRM SMS Gateway token is not configured.',
      raw: {},
    })
    return
  }
  const token = readBearerToken(req)
  if (!token || token !== expected) {
    res.status(401).json({
      success: false,
      providerMessageId: null,
      errorCode: 'gateway_auth_error',
      errorMessage: 'Gateway 인증에 실패했습니다.',
      raw: {},
    })
    return
  }
  next()
}

function validateSendPayload(body) {
  const userId = String(body?.user_id ?? '').trim()
  const apiKey = String(body?.api_key ?? '').trim()
  const sender = String(body?.sender ?? '').trim()
  const receiver = String(body?.receiver ?? '').trim()
  const message = String(body?.message ?? '').trim()
  if (!userId || !apiKey || !sender || !receiver || !message) {
    return { ok: false, message: 'user_id, api_key, sender, receiver, message are required' }
  }
  return { ok: true }
}

function validateBalancePayload(body) {
  const userId = String(body?.user_id ?? '').trim()
  const apiKey = String(body?.api_key ?? '').trim()
  if (!userId || !apiKey) {
    return { ok: false, message: 'user_id and api_key are required' }
  }
  return { ok: true }
}

export function createCrmSmsRouter() {
  const router = express.Router()
  router.use(crmGatewayAuth)

  router.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'crm-sms-gateway' })
  })

  router.post('/send', async (req, res) => {
    const validation = validateSendPayload(req.body)
    if (!validation.ok) {
      res.status(400).json({
        success: false,
        providerMessageId: null,
        errorCode: 'provider_error',
        errorMessage: validation.message,
        raw: {},
      })
      return
    }

    const result = await sendViaAligo(req.body)
    logCrmGatewayEvent({
      requestId: req.body?.request_id,
      provider: req.body?.provider ?? 'aligo',
      sender: req.body?.sender,
      receiver: req.body?.receiver,
      success: result.success,
      errorCode: result.errorCode,
      durationMs: result.durationMs,
    })

    res.status(result.success ? 200 : 502).json({
      success: result.success,
      providerMessageId: result.providerMessageId,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      raw: result.raw,
      testMode: result.testMode === true,
    })
  })

  router.post('/balance', async (req, res) => {
    const validation = validateBalancePayload(req.body)
    if (!validation.ok) {
      res.status(400).json({
        success: false,
        balanceText: null,
        errorCode: 'provider_error',
        errorMessage: validation.message,
        raw: {},
      })
      return
    }

    const result = await balanceViaAligo(req.body)
    logCrmGatewayEvent({
      requestId: req.body?.request_id,
      provider: req.body?.provider ?? 'aligo',
      success: result.success,
      errorCode: result.errorCode,
      durationMs: result.durationMs,
    })

    res.status(result.success ? 200 : 502).json({
      success: result.success,
      balanceText: result.balanceText,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      raw: result.raw,
    })
  })

  return router
}
