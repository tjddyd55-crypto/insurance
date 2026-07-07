/**
 * @typedef {'invalid_api_key' | 'sender_not_registered' | 'insufficient_balance' | 'invalid_receiver' | 'provider_error' | 'network_error' | 'gateway_auth_error'} SmsProviderErrorCode
 */

const ERROR_PATTERNS = [
  { code: 'invalid_api_key', patterns: [/api\s*key/i, /인증/i, /key/i, /permission/i, /unauthorized/i] },
  { code: 'sender_not_registered', patterns: [/발신/i, /sender/i, /등록/i, /번호/i] },
  { code: 'insufficient_balance', patterns: [/잔액/i, /포인트/i, /부족/i, /remain/i, /balance/i] },
  { code: 'invalid_receiver', patterns: [/수신/i, /receiver/i, /휴대/i, /phone/i] },
]

/**
 * @param {{ resultCode?: number; message?: string; network?: boolean }} input
 * @returns {{ code: SmsProviderErrorCode; publicMessage: string }}
 */
export function classifyAligoProviderError(input) {
  if (input.network) {
    return {
      code: 'network_error',
      publicMessage: '알리고 서버와 통신하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    }
  }
  const message = String(input.message ?? '').trim()
  const lower = message.toLowerCase()
  for (const item of ERROR_PATTERNS) {
    if (item.patterns.some((p) => p.test(message) || p.test(lower))) {
      return { code: item.code, publicMessage: mapPublicMessage(item.code, message) }
    }
  }
  return {
    code: 'provider_error',
    publicMessage: message || '알리고 처리 중 오류가 발생했습니다.',
  }
}

/**
 * @param {SmsProviderErrorCode} code
 * @param {string} fallback
 */
function mapPublicMessage(code, fallback) {
  switch (code) {
    case 'invalid_api_key':
      return '알리고 API Key 또는 계정 정보를 확인해 주세요.'
    case 'sender_not_registered':
      return '발신번호가 알리고에 등록되어 있는지 확인해 주세요.'
    case 'insufficient_balance':
      return '알리고 계정 잔액/잔여건수가 부족합니다. 알리고 사이트에서 충전해 주세요.'
    case 'invalid_receiver':
      return '수신번호 형식을 확인해 주세요.'
    case 'network_error':
      return '알리고 서버와 통신하지 못했습니다. 잠시 후 다시 시도해 주세요.'
    case 'gateway_auth_error':
      return 'CRM SMS Gateway 인증에 실패했습니다. 관리자에게 문의해 주세요.'
    default:
      return fallback || '알리고 처리 중 오류가 발생했습니다.'
  }
}

/**
 * axios/log용 — key 파라미터 마스킹
 * @param {string} body
 */
export function maskAligoRequestBodyForLog(body) {
  return String(body ?? '').replace(/(^|&)key=[^&]*/gi, '$1key=****')
}

/**
 * @param {Record<string, unknown>} payload
 */
export function maskGatewayPayloadForLog(payload) {
  if (!payload || typeof payload !== 'object') {
    return {}
  }
  const clone = { ...payload }
  if ('api_key' in clone) {
    clone.api_key = '****'
  }
  if ('sender' in clone) {
    clone.sender = maskPhoneTail(String(clone.sender ?? ''))
  }
  if ('receiver' in clone) {
    clone.receiver = maskPhoneTail(String(clone.receiver ?? ''))
  }
  if ('message' in clone) {
    clone.message = '[redacted]'
  }
  return clone
}

function maskPhoneTail(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length < 4) {
    return '****'
  }
  return `***${digits.slice(-4)}`
}

/**
 * @param {{ errorCode?: unknown; message?: string; network?: boolean; httpStatus?: number }} input
 * @returns {{ code: SmsProviderErrorCode; publicMessage: string }}
 */
export function classifyGatewayProviderError(input) {
  if (input.network) {
    return {
      code: 'network_error',
      publicMessage: 'CRM SMS Gateway와 통신하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    }
  }
  if (input.httpStatus === 401 || String(input.errorCode ?? '') === 'gateway_auth_error') {
    return {
      code: 'gateway_auth_error',
      publicMessage: 'CRM SMS Gateway 인증에 실패했습니다. 관리자에게 문의해 주세요.',
    }
  }
  const explicit = String(input.errorCode ?? '').trim()
  if (
    explicit === 'invalid_api_key' ||
    explicit === 'sender_not_registered' ||
    explicit === 'insufficient_balance' ||
    explicit === 'invalid_receiver' ||
    explicit === 'provider_error' ||
    explicit === 'network_error'
  ) {
    return { code: explicit, publicMessage: mapPublicMessage(explicit, String(input.message ?? '')) }
  }
  return classifyAligoProviderError({ message: input.message, network: input.network })
}
