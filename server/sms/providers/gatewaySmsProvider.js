import axios from 'axios'
import { sanitizeProviderRaw } from '../smsCredentialsCrypto.js'
import { isAligoTestModeEnabled } from '../smsModuleConfig.js'
import {
  classifyGatewayProviderError,
  maskGatewayPayloadForLog,
} from '../smsProviderErrors.js'
import { resolveMessageType } from '../smsMessageUtils.js'

const GATEWAY_TIMEOUT_MS = (() => {
  const n = Number(process.env.SMS_MODULE_GATEWAY_TIMEOUT_MS ?? 10000)
  return Number.isFinite(n) && n >= 3000 ? Math.min(n, 20000) : 10000
})()

function normalizeGatewayBaseUrl() {
  return String(process.env.SMS_MODULE_GATEWAY_URL ?? '')
    .trim()
    .replace(/\/$/, '')
}

export function getSmsModuleGatewayBaseUrl() {
  return normalizeGatewayBaseUrl()
}

export function getSmsModuleGatewayToken() {
  return String(process.env.SMS_MODULE_GATEWAY_TOKEN ?? '').trim()
}

export function buildGatewayAuthHeaders() {
  const token = getSmsModuleGatewayToken()
  if (!token) {
    return null
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

function formatScheduled(input) {
  const dt = input.scheduledAt instanceof Date ? input.scheduledAt : null
  if (!dt || Number.isNaN(dt.getTime())) {
    return null
  }
  return dt.toISOString()
}

/**
 * @param {import('./smsProvider.js').SmsSendInput} input
 */
export function buildGatewaySendPayload(input) {
  const testMode = isAligoTestModeEnabled()
  return {
    provider: 'aligo',
    user_id: String(input.providerUserId ?? ''),
    api_key: String(input.apiKey ?? ''),
    sender: String(input.from ?? ''),
    receiver: String(input.to ?? ''),
    message: String(input.message ?? ''),
    message_type: input.messageType ?? resolveMessageType(String(input.message ?? '')),
    scheduled_at: formatScheduled(input),
    testmode_yn: testMode ? 'Y' : 'N',
    request_id: input.requestId != null ? String(input.requestId) : undefined,
  }
}

/**
 * @param {import('./smsProvider.js').SmsBalanceInput} input
 */
export function buildGatewayBalancePayload(input) {
  return {
    provider: 'aligo',
    user_id: String(input.providerUserId ?? ''),
    api_key: String(input.apiKey ?? ''),
  }
}

/**
 * @param {unknown} data
 * @param {{ network?: boolean; httpStatus?: number }} meta
 */
export function parseGatewayResponse(data, meta = {}) {
  if (meta.network) {
    const classified = classifyGatewayProviderError({ network: true })
    return {
      success: false,
      errorMessage: classified.publicMessage,
      errorCode: classified.code,
      raw: sanitizeProviderRaw({ network_error: true }),
    }
  }
  if (meta.httpStatus === 401) {
    const classified = classifyGatewayProviderError({ httpStatus: 401 })
    return {
      success: false,
      errorMessage: classified.publicMessage,
      errorCode: classified.code,
      raw: sanitizeProviderRaw(data),
    }
  }
  const body = data && typeof data === 'object' ? data : {}
  const success = Boolean(body.success)
  if (!success) {
    const classified = classifyGatewayProviderError({
      errorCode: body.errorCode ?? body.error_code,
      message: body.errorMessage ?? body.error_message,
      httpStatus: meta.httpStatus,
    })
    return {
      success: false,
      errorMessage: classified.publicMessage,
      errorCode: classified.code,
      raw: sanitizeProviderRaw(body.raw ?? body),
    }
  }
  return {
    success: true,
    providerMessageId: body.providerMessageId ?? body.provider_message_id ?? undefined,
    errorCode: null,
    errorMessage: null,
    raw: sanitizeProviderRaw(body.raw ?? body),
    testMode: body.testMode === true || body.test_mode === true,
  }
}

/**
 * @param {{ post?: typeof axios.post }} [deps]
 */
export function createGatewaySmsProvider(deps = {}) {
  const post = deps.post ?? axios.post.bind(axios)

  return {
    async send(input) {
      const baseUrl = getSmsModuleGatewayBaseUrl()
      const headers = buildGatewayAuthHeaders()
      if (!baseUrl || !headers) {
        const classified = classifyGatewayProviderError({ message: 'gateway_not_configured' })
        return {
          success: false,
          errorMessage: classified.publicMessage,
          errorCode: classified.code,
          raw: sanitizeProviderRaw({ gateway_not_configured: true }),
        }
      }

      const payload = buildGatewaySendPayload(input)
      const testMode = payload.testmode_yn === 'Y'
      try {
        const res = await post(`${baseUrl}/send`, payload, {
          headers,
          timeout: GATEWAY_TIMEOUT_MS,
          validateStatus: () => true,
        })
        const parsed = parseGatewayResponse(res.data, { httpStatus: res.status })
        return {
          success: parsed.success,
          providerMessageId: parsed.providerMessageId,
          errorMessage: parsed.errorMessage,
          errorCode: parsed.errorCode,
          raw: parsed.raw,
          testMode,
        }
      } catch {
        if (process.env.NODE_ENV !== 'test') {
          console.error('[sms-module][gateway] send network error', maskGatewayPayloadForLog(payload))
        }
        const classified = classifyGatewayProviderError({ network: true })
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
      const baseUrl = getSmsModuleGatewayBaseUrl()
      const headers = buildGatewayAuthHeaders()
      if (!baseUrl || !headers) {
        const classified = classifyGatewayProviderError({ message: 'gateway_not_configured' })
        return {
          success: false,
          errorMessage: `${classified.publicMessage} API Key, 서버 IP 등록, 알리고 계정 상태를 확인해 주세요.`,
          errorCode: classified.code,
          raw: sanitizeProviderRaw({ gateway_not_configured: true }),
        }
      }

      const payload = buildGatewayBalancePayload(input)
      try {
        const res = await post(`${baseUrl}/balance`, payload, {
          headers,
          timeout: GATEWAY_TIMEOUT_MS,
          validateStatus: () => true,
        })
        const parsed = parseGatewayResponse(res.data, { httpStatus: res.status })
        if (!parsed.success) {
          return {
            success: false,
            errorMessage: parsed.errorMessage,
            errorCode: parsed.errorCode,
            raw: parsed.raw,
          }
        }
        const balanceText =
          res.data?.balanceText ??
          res.data?.balance_text ??
          '잔액 조회에 성공했습니다.'
        return {
          success: true,
          balanceText: String(balanceText),
          raw: parsed.raw,
        }
      } catch {
        if (process.env.NODE_ENV !== 'test') {
          console.error('[sms-module][gateway] balance network error', maskGatewayPayloadForLog(payload))
        }
        const classified = classifyGatewayProviderError({ network: true })
        return {
          success: false,
          errorMessage: `${classified.publicMessage} API Key, 서버 IP 등록, 알리고 계정 상태를 확인해 주세요.`,
          errorCode: classified.code,
          raw: sanitizeProviderRaw({ network_error: true }),
        }
      }
    },
  }
}

/** @type {import('./smsProvider.js').SmsProvider} */
export const gatewaySmsProvider = createGatewaySmsProvider()
