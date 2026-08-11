/**
 * Aligo template/list 검수상태 조회 + 5분 메모리 캐시.
 * 고객등록 완료 알림톡은 inspStatus=APR 일 때만 provider 실발송.
 */

import {
  isInsuranceAlimtalkCredentialsComplete,
  loadInsuranceAlimtalkConfig,
} from './alimtalkConfig.js'

export const ALIGO_ALIMTALK_TEMPLATE_LIST_URL = 'https://kakaoapi.aligo.in/akv10/template/list/'
export const TEMPLATE_STATUS_CACHE_TTL_MS = 5 * 60 * 1000

/** @type {Map<string, { expiresAt: number, value: Awaited<ReturnType<typeof fetchAligoTemplateStatusOnce>> }>} */
const statusCache = new Map()

/**
 * @param {unknown} raw
 */
export function normalizeAligoTemplateInspectionStatus(raw) {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
  if (!s) return null
  if (s === 'APR' || s === 'APPROVED' || s === 'A') return 'APR'
  if (s === 'REJ' || s === 'REJECT' || s === 'REJECTED' || s === 'R') return 'REJ'
  if (s === 'REQ' || s === 'REG' || s === 'INSPECT' || s === 'PENDING' || s === 'WAIT') return 'REQ'
  return s
}

/**
 * @param {unknown} item
 */
export function pickTemplateCode(item) {
  if (!item || typeof item !== 'object') return ''
  const row = /** @type {Record<string, unknown>} */ (item)
  return String(row.templtCode ?? row.tpl_code ?? row.tplCode ?? row.code ?? '').trim()
}

/**
 * @param {unknown} item
 */
export function pickTemplateInspectionStatus(item) {
  if (!item || typeof item !== 'object') return null
  const row = /** @type {Record<string, unknown>} */ (item)
  return normalizeAligoTemplateInspectionStatus(
    row.inspStatus ?? row.status ?? row.templtStatus ?? row.templateStatus,
  )
}

/**
 * @param {unknown} item
 */
export function summarizeAligoTemplate(item) {
  if (!item || typeof item !== 'object') {
    return null
  }
  const row = /** @type {Record<string, unknown>} */ (item)
  const buttons = row.buttons ?? row.button ?? row.templtButtons ?? null
  return {
    templtCode: pickTemplateCode(item) || null,
    name: row.name != null ? String(row.name) : row.templtName != null ? String(row.templtName) : null,
    inspStatus: pickTemplateInspectionStatus(item),
    templtContent:
      row.templtContent != null
        ? String(row.templtContent)
        : row.content != null
          ? String(row.content)
          : null,
    buttons: buttons ?? null,
  }
}

/**
 * @param {ReturnType<typeof loadInsuranceAlimtalkConfig>} config
 * @param {string} tplCode
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
export async function fetchAligoTemplateStatusOnce(config, tplCode, opts = {}) {
  const code = String(tplCode ?? '').trim()
  if (!code) {
    return {
      ok: false,
      reason: 'TEMPLATE_NOT_CONFIGURED',
      templateCode: null,
      inspStatus: null,
      template: null,
      via: config.useGateway ? 'gateway' : 'direct',
    }
  }
  if (!isInsuranceAlimtalkCredentialsComplete(config)) {
    return {
      ok: false,
      reason: 'CREDENTIALS_MISSING',
      templateCode: code,
      inspStatus: null,
      template: null,
      via: config.useGateway ? 'gateway' : 'direct',
    }
  }

  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  try {
    let list = []
    let providerCode = null
    let providerMessage = null
    let via = 'direct'

    if (config.useGateway) {
      via = 'gateway'
      if (!config.gatewayToken) {
        return {
          ok: false,
          reason: 'TEMPLATE_STATUS_UNAVAILABLE',
          templateCode: code,
          inspStatus: null,
          template: null,
          via,
          providerMessage: 'gateway token missing',
        }
      }
      const url = `${config.gatewayUrl.replace(/\/+$/, '')}/template-list`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), config.sendTimeoutMs)
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.gatewayToken}`,
        },
        body: JSON.stringify({
          apikey: config.apiKey,
          userid: config.userId,
          senderkey: config.senderKey,
          tpl_code: code,
        }),
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
      providerCode =
        parsed?.providerCode != null
          ? Number(parsed.providerCode)
          : parsed?.code != null
            ? Number(parsed.code)
            : null
      providerMessage =
        parsed?.providerMessage != null
          ? String(parsed.providerMessage)
          : parsed?.message != null
            ? String(parsed.message)
            : null
      list = Array.isArray(parsed?.list) ? parsed.list : []
      if (!res.ok && list.length === 0) {
        return {
          ok: false,
          reason: 'TEMPLATE_STATUS_UNAVAILABLE',
          templateCode: code,
          inspStatus: null,
          template: null,
          via,
          providerCode,
          providerMessage,
        }
      }
    } else {
      const params = new URLSearchParams()
      params.set('apikey', config.apiKey)
      params.set('userid', config.userId)
      params.set('senderkey', config.senderKey)
      params.set('tpl_code', code)
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), config.sendTimeoutMs)
      const res = await fetchImpl(ALIGO_ALIMTALK_TEMPLATE_LIST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
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
      providerCode = parsed?.code != null ? Number(parsed.code) : null
      providerMessage = parsed?.message != null ? String(parsed.message) : null
      list = Array.isArray(parsed?.list) ? parsed.list : []
      if (!res.ok || providerCode !== 0) {
        return {
          ok: false,
          reason: 'TEMPLATE_STATUS_UNAVAILABLE',
          templateCode: code,
          inspStatus: null,
          template: null,
          via,
          providerCode,
          providerMessage,
        }
      }
    }

    const matched =
      list.find((item) => pickTemplateCode(item) === code) ||
      (list.length === 1 ? list[0] : null)
    if (!matched) {
      return {
        ok: false,
        reason: 'TEMPLATE_NOT_FOUND',
        templateCode: code,
        inspStatus: null,
        template: null,
        via,
        providerCode,
        providerMessage,
      }
    }

    const inspStatus = pickTemplateInspectionStatus(matched)
    return {
      ok: true,
      reason: null,
      templateCode: code,
      inspStatus,
      template: summarizeAligoTemplate(matched),
      via,
      providerCode,
      providerMessage,
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'TEMPLATE_STATUS_UNAVAILABLE',
      templateCode: code,
      inspStatus: null,
      template: null,
      via: config.useGateway ? 'gateway' : 'direct',
      providerMessage: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * @param {string} tplCode
 */
export function clearAligoTemplateStatusCache(tplCode) {
  if (tplCode) statusCache.delete(String(tplCode).trim())
  else statusCache.clear()
}

/**
 * @param {ReturnType<typeof loadInsuranceAlimtalkConfig>} config
 * @param {string} tplCode
 * @param {{ fetchImpl?: typeof fetch, nowMs?: number, bypassCache?: boolean }} [opts]
 */
export async function getCachedAligoTemplateStatus(config, tplCode, opts = {}) {
  const code = String(tplCode ?? '').trim()
  const nowMs = Number(opts.nowMs) || Date.now()
  if (!opts.bypassCache) {
    const hit = statusCache.get(code)
    if (hit && hit.expiresAt > nowMs) {
      return { ...hit.value, fromCache: true }
    }
  }
  const value = await fetchAligoTemplateStatusOnce(config, code, opts)
  statusCache.set(code, {
    expiresAt: nowMs + TEMPLATE_STATUS_CACHE_TTL_MS,
    value,
  })
  return { ...value, fromCache: false }
}

/**
 * @param {ReturnType<typeof loadInsuranceAlimtalkConfig>} config
 * @param {string} tplCode
 * @param {{ fetchImpl?: typeof fetch, nowMs?: number, bypassCache?: boolean }} [opts]
 */
export async function resolveCustomerRegistrationTemplateSendGate(config, tplCode, opts = {}) {
  const status = await getCachedAligoTemplateStatus(config, tplCode, opts)
  if (!status.ok) {
    const reason =
      status.reason === 'TEMPLATE_NOT_FOUND'
        ? 'TEMPLATE_NOT_FOUND'
        : status.reason === 'TEMPLATE_NOT_CONFIGURED'
          ? 'TEMPLATE_NOT_CONFIGURED'
          : status.reason === 'CREDENTIALS_MISSING'
            ? 'CREDENTIALS_MISSING'
            : 'TEMPLATE_STATUS_UNAVAILABLE'
    return {
      allowSend: false,
      terminalSkip: reason === 'TEMPLATE_NOT_FOUND' || reason === 'TEMPLATE_NOT_CONFIGURED',
      reason,
      templateStatus: status.inspStatus,
      template: status.template,
      fromCache: Boolean(status.fromCache),
      via: status.via,
    }
  }

  if (status.inspStatus === 'APR') {
    return {
      allowSend: true,
      terminalSkip: false,
      reason: null,
      templateStatus: 'APR',
      template: status.template,
      fromCache: Boolean(status.fromCache),
      via: status.via,
    }
  }

  if (status.inspStatus === 'REJ') {
    return {
      allowSend: false,
      terminalSkip: true,
      reason: 'TEMPLATE_REJECTED',
      templateStatus: 'REJ',
      template: status.template,
      fromCache: Boolean(status.fromCache),
      via: status.via,
    }
  }

  // REQ / REG / unknown during inspection — terminal skip (승인 후 과거건 일괄발송 금지)
  return {
    allowSend: false,
    terminalSkip: true,
    reason: 'SKIPPED_TEMPLATE_NOT_APPROVED',
    templateStatus: status.inspStatus || 'REQ',
    template: status.template,
    fromCache: Boolean(status.fromCache),
    via: status.via,
  }
}

/**
 * sync diagnostics 용 — 캐시에 있으면 사용, 없으면 unknown.
 * @param {string} tplCode
 */
export function peekCachedAligoTemplateStatus(tplCode) {
  const code = String(tplCode ?? '').trim()
  const hit = statusCache.get(code)
  if (!hit) return null
  if (hit.expiresAt <= Date.now()) return null
  return hit.value
}
