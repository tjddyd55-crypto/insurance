import {
  isInsuranceAlimtalkCredentialsComplete,
  loadInsuranceAlimtalkConfig,
} from './alimtalkConfig.js'

/**
 * @param {unknown} raw
 */
export function pickAligoAlimtalkCode(raw) {
  if (!raw || typeof raw !== 'object') return null
  const obj = /** @type {Record<string, unknown>} */ (raw)
  const code = obj.code ?? obj.result_code ?? obj.resultCode ?? obj.providerCode
  if (code == null || code === '') return null
  const n = Number(code)
  if (Number.isFinite(n)) return n
  return null
}

/**
 * @param {unknown} raw
 */
export function pickAligoAlimtalkMessage(raw) {
  if (!raw || typeof raw !== 'object') return null
  const obj = /** @type {Record<string, unknown>} */ (raw)
  const msg = obj.message ?? obj.msg ?? obj.result_message ?? obj.providerMessage
  return msg != null ? String(msg).slice(0, 300) : null
}

/**
 * @param {unknown} raw
 */
export function pickAligoAlimtalkMessageId(raw) {
  if (!raw || typeof raw !== 'object') return null
  const obj = /** @type {Record<string, unknown>} */ (raw)
  const info = obj.info && typeof obj.info === 'object' ? /** @type {Record<string, unknown>} */ (obj.info) : null
  const id =
    (info && info.mid) ||
    obj.mid ||
    obj.message_id ||
    obj.msg_id ||
    obj.providerMessageId
  return id != null ? String(id) : null
}

/**
 * code === 0 만 성공. HTTP 200 단독으로는 성공 처리하지 않음.
 * @param {number | null} code
 */
export function isAligoAlimtalkSuccessCode(code) {
  return code === 0
}

/**
 * @param {ReturnType<typeof loadInsuranceAlimtalkConfig>} config
 * @param {{
 *   tplCode: string,
 *   receiver: string,
 *   subject: string,
 *   message: string,
 *   buttonPayload: { button: Array<Record<string, string>> },
 *   recvName?: string,
 * }} input
 */
function buildSendFormParams(config, input) {
  const params = new URLSearchParams()
  params.set('apikey', config.apiKey)
  params.set('userid', config.userId)
  params.set('senderkey', config.senderKey)
  params.set('tpl_code', String(input.tplCode ?? '').trim())
  params.set('sender', config.sender)
  params.set('receiver_1', String(input.receiver).replace(/\D/g, ''))
  params.set('recvname_1', String(input.recvName ?? '고객').trim() || '고객')
  params.set('subject_1', String(input.subject ?? '').trim())
  params.set('message_1', String(input.message ?? ''))
  params.set('button_1', JSON.stringify(input.buttonPayload))
  params.set('failover', 'N')
  params.set('testMode', config.testMode)
  return params
}

/**
 * @param {ReturnType<typeof loadInsuranceAlimtalkConfig>} config
 * @param {Record<string, unknown>} body
 * @param {typeof fetch} fetchImpl
 * @param {string} path
 */
async function postGatewayJson(config, body, fetchImpl, path) {
  if (!config.gatewayUrl) {
    throw new Error('gateway url missing')
  }
  if (!config.gatewayToken) {
    return {
      ok: false,
      httpStatus: null,
      parsed: {
        providerCode: null,
        providerMessage: 'Alimtalk gateway token is not configured',
      },
    }
  }
  const url = `${config.gatewayUrl.replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.sendTimeoutMs)
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.gatewayToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)
    const text = await res.text()
    let parsed = {}
    try {
      parsed = text ? JSON.parse(text) : {}
    } catch {
      parsed = { message: String(text).slice(0, 300) }
    }
    return { ok: true, httpStatus: res.status, parsed }
  } catch (err) {
    clearTimeout(timer)
    const isTimeout = Boolean(err && typeof err === 'object' && 'name' in err && err.name === 'AbortError')
    return {
      ok: false,
      httpStatus: null,
      parsed: {
        providerCode: null,
        providerMessage: isTimeout ? 'provider timeout' : 'network error',
      },
    }
  }
}

/**
 * @param {{
 *   config?: ReturnType<typeof loadInsuranceAlimtalkConfig>,
 *   dryRun?: boolean,
 *   tplCode: string,
 *   receiver: string,
 *   subject: string,
 *   message: string,
 *   buttonPayload: { button: Array<Record<string, string>> },
 *   recvName?: string,
 *   fetchImpl?: typeof fetch,
 *   templateKey?: string,
 * }} input
 */
export async function sendAligoAlimtalk(input) {
  const config = input.config ?? loadInsuranceAlimtalkConfig()
  const dryRun = input.dryRun != null ? Boolean(input.dryRun) : config.dryRun
  const requestedAt = new Date().toISOString()

  if (dryRun) {
    return {
      ok: true,
      status: /** @type {'dry_run'} */ ('dry_run'),
      dryRun: true,
      provider: config.provider,
      providerMessageId: null,
      providerCode: null,
      providerMessage: 'dry run',
      httpStatus: null,
      requestedAt,
      sentAt: null,
      failedAt: null,
      payloadPreview: {
        tpl_code: input.tplCode,
        subject_1: input.subject,
        message_1: input.message,
        button_1: input.buttonPayload,
        failover: 'N',
        testMode: config.testMode,
        via: config.useGateway ? 'gateway' : 'direct',
      },
    }
  }

  if (!isInsuranceAlimtalkCredentialsComplete(config)) {
    return {
      ok: false,
      status: /** @type {'failed'} */ ('failed'),
      dryRun: false,
      provider: config.provider,
      providerMessageId: null,
      providerCode: null,
      providerMessage: 'Aligo credentials not configured (INSURANCE_ALIGO_KAKAO_*)',
      httpStatus: null,
      requestedAt,
      sentAt: null,
      failedAt: requestedAt,
    }
  }

  const tplCode = String(input.tplCode ?? '').trim()
  if (!tplCode) {
    return {
      ok: false,
      status: /** @type {'failed'} */ ('failed'),
      dryRun: false,
      provider: config.provider,
      providerMessageId: null,
      providerCode: null,
      providerMessage: 'tpl_code is empty',
      httpStatus: null,
      requestedAt,
      sentAt: null,
      failedAt: requestedAt,
    }
  }

  const fetchImpl = input.fetchImpl ?? globalThis.fetch

  try {
    let providerCode = null
    let providerMessage = null
    let providerMessageId = null
    let httpStatus = null

    if (config.useGateway) {
      const gatewayBody = {
        apikey: config.apiKey,
        userid: config.userId,
        senderkey: config.senderKey,
        tpl_code: tplCode,
        sender: config.sender,
        receiver_1: String(input.receiver).replace(/\D/g, ''),
        recvname_1: String(input.recvName ?? '고객').trim() || '고객',
        subject_1: String(input.subject ?? '').trim(),
        message_1: String(input.message ?? ''),
        button_1: input.buttonPayload,
        failover: 'N',
        testMode: config.testMode,
      }
      const gw = await postGatewayJson(config, gatewayBody, fetchImpl, 'send')
      httpStatus = gw.httpStatus
      providerCode = pickAligoAlimtalkCode(gw.parsed)
      providerMessage = pickAligoAlimtalkMessage(gw.parsed) || 'aligo response'
      providerMessageId = pickAligoAlimtalkMessageId(gw.parsed)
    } else {
      const params = buildSendFormParams(config, { ...input, tplCode })
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), config.sendTimeoutMs)
      const res = await fetchImpl(config.sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: controller.signal,
      })
      clearTimeout(timer)
      httpStatus = res.status
      const text = await res.text()
      let parsed = {}
      try {
        parsed = text ? JSON.parse(text) : {}
      } catch {
        parsed = { message: String(text).slice(0, 300) }
      }
      providerCode = pickAligoAlimtalkCode(parsed)
      providerMessage = pickAligoAlimtalkMessage(parsed) || 'aligo response'
      providerMessageId = pickAligoAlimtalkMessageId(parsed)
    }

    console.info('[alimtalk] provider result', {
      templateKey: input.templateKey ?? null,
      tplCode,
      via: config.useGateway ? 'gateway' : 'direct',
      httpStatus,
      providerCode,
      providerMessage,
      credentialConfigured: true,
      senderKeyConfigured: Boolean(config.senderKey),
    })

    if (isAligoAlimtalkSuccessCode(providerCode)) {
      return {
        ok: true,
        status: /** @type {'sent'} */ ('sent'),
        dryRun: false,
        provider: config.provider,
        providerMessageId,
        providerCode,
        providerMessage,
        httpStatus,
        requestedAt,
        sentAt: new Date().toISOString(),
        failedAt: null,
      }
    }

    return {
      ok: false,
      status: /** @type {'failed'} */ ('failed'),
      dryRun: false,
      provider: config.provider,
      providerMessageId,
      providerCode,
      providerMessage,
      httpStatus,
      requestedAt,
      sentAt: null,
      failedAt: new Date().toISOString(),
    }
  } catch (err) {
    const isTimeout = Boolean(err && typeof err === 'object' && 'name' in err && err.name === 'AbortError')
    const providerMessage = isTimeout ? 'provider timeout' : 'network error'
    console.info('[alimtalk] provider failed', {
      templateKey: input.templateKey ?? null,
      tplCode,
      via: config.useGateway ? 'gateway' : 'direct',
      httpStatus: null,
      providerCode: null,
      providerMessage,
    })
    return {
      ok: false,
      status: /** @type {'failed'} */ ('failed'),
      dryRun: false,
      provider: config.provider,
      providerMessageId: null,
      providerCode: null,
      providerMessage,
      httpStatus: null,
      requestedAt,
      sentAt: null,
      failedAt: new Date().toISOString(),
    }
  }
}
