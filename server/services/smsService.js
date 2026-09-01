import axios from 'axios'
import { logSmsDelivery, logSmsRetry } from './smsStructuredLog.js'
import { SMS_PUBLIC_DELAY_MESSAGE } from './smsPublicMessages.js'
import {
  assertSmsCircuitClosed,
  recordSmsSendFailure,
  recordSmsSendSuccess,
} from './smsCircuitBreaker.js'
import { assertExternalSideEffectAllowed } from '../lib/qaSafeMode.js'

const ALIGO_API_KEY = process.env.ALIGO_API_KEY
const ALIGO_USER_ID = process.env.ALIGO_USER_ID
const ALIGO_SENDER = process.env.ALIGO_SENDER

/** 레거시 EC2 sms-server (JSON `{ phone, message }`). CRM gateway 미설정 시에만 사용 */
const SMS_HTTP_GATEWAY_URL = String(process.env.SMS_HTTP_GATEWAY_URL ?? '').trim()

const ALIGO_URL = 'https://apis.aligo.in/send/'

/** 회원가입·비밀번호 재설정·휴대폰 변경 등 필수 인증 SMS — CRM 단체문자 REAL_SEND 와 분리 */
export const SERVICE_AUTH_SMS_PURPOSES = new Set([
  'SIGNUP',
  'PHONE_CHANGE',
  'PASSWORD_RESET',
  'ACCOUNT_RESET',
])

export function isServiceAuthSmsPurpose(purpose) {
  return SERVICE_AUTH_SMS_PURPOSES.has(String(purpose ?? '').trim().toUpperCase())
}

const IS_PRODUCTION =
  process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT)

const SMS_GATEWAY_HEALTH_CHECK =
  String(process.env.SMS_GATEWAY_HEALTH_CHECK ?? '').trim().toLowerCase() === 'true'

const HEALTH_CHECK_TIMEOUT_MS = (() => {
  const n = Number(process.env.SMS_GATEWAY_HEALTH_TIMEOUT_MS ?? 2000)
  return Number.isFinite(n) && n >= 500 ? Math.min(n, 5000) : 2000
})()

/** 3~5초 권장 — env로 덮어쓰기 가능 */
const SMS_SEND_TIMEOUT_MS = (() => {
  const n = Number(process.env.SMS_SEND_TIMEOUT_MS ?? 5000)
  if (!Number.isFinite(n) || n < 3000) {
    return 5000
  }
  return Math.min(n, 8000)
})()

const RETRY_DELAY_MS = 400

function maskPhone(phoneDigits) {
  const d = String(phoneDigits ?? '').replace(/\D/g, '')
  if (d.length < 4) {
    return '***'
  }
  return `***${d.slice(-4)}`
}

/** env 플래그를 true 로 해석한다. 참으로 명시된 값만 true, 그 외·공백·미설정은 false */
function normalizeBooleanEnv(raw) {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
  return s === '1' || s === 'TRUE' || s === 'YES' || s === 'Y' || s === 'ON' || s === 'T'
}

function normalizePhoneNumber(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function isDevelopmentDeploy() {
  const appEnv = String(process.env.APP_ENV ?? '').trim().toLowerCase()
  if (appEnv === 'development') {
    return true
  }
  const rail = String(process.env.RAILWAY_ENVIRONMENT_NAME ?? '').trim().toLowerCase()
  return rail === 'development'
}

/** TEST_RECIPIENTS: 공백/쉼표/세미콜론/파이프/줄바꿈으로 구분된 수신 테스트 번호(숫자만 정규화) */
function getAllowedTestRecipients() {
  const raw = String(process.env.TEST_RECIPIENTS ?? '')
  const seen = new Set()
  const parts = raw.split(/[\s,;|\n\r]+/).filter(Boolean)
  for (const p of parts) {
    const d = normalizePhoneNumber(p)
    if (d.length > 0) {
      seen.add(d)
    }
  }
  return seen
}

/**
 * 발송 허용 정책 (development 전용 차단만 반환값에 반영한다).
 * production 은 `{ kind:'production' }` 로 기존 gateway/알리고 순서 유지.
 * 필수 인증 SMS(SIGNUP 등)는 단체문자 dev mock 정책과 분리해 항상 production 경로를 탄다.
 * @returns {{ kind: 'production' } | { kind: 'mock', reason: string } | { kind: 'allow_real_test_recipient' }}
 */
export function resolveSmsSendPolicy(receiverDigits, purpose = '') {
  if (isServiceAuthSmsPurpose(purpose)) {
    return { kind: 'production' }
  }
  if (!isDevelopmentDeploy()) {
    return { kind: 'production' }
  }
  if (normalizeBooleanEnv(process.env.DISABLE_REAL_SEND)) {
    return { kind: 'mock', reason: 'real_send_disabled' }
  }
  if (!normalizeBooleanEnv(process.env.ALLOW_TEST_RECIPIENTS_ONLY)) {
    return { kind: 'mock', reason: 'allowlist_disabled' }
  }
  const allowed = getAllowedTestRecipients()
  if (allowed.size === 0) {
    return { kind: 'mock', reason: 'no_test_recipients' }
  }
  if (!allowed.has(receiverDigits)) {
    return { kind: 'mock', reason: 'recipient_not_allowed' }
  }
  return { kind: 'allow_real_test_recipient' }
}

/** Y/true/1/yes/on/t — 알리고 테스트·비발송 분기 및 testmode 파라미터 근거 */
function isAligoTestModeOn() {
  const raw = String(process.env.ALIGO_TEST_MODE ?? 'Y').trim()
  const effective = raw === '' ? 'Y' : raw
  const u = effective.toUpperCase()
  return u === 'Y' || u === 'TRUE' || u === 'T' || u === '1' || u === 'YES' || u === 'ON'
}

/** 실제 알리고 POST 시 testmode_yn — 비테스트 분기에서는 N 고정으로 전송 신호 명확화 */
function aligoFormTestmodeYn() {
  return isAligoTestModeOn() ? 'Y' : 'N'
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function resolveCrmAuthGatewayBaseUrl(env = process.env) {
  return String(env.SMS_MODULE_GATEWAY_URL ?? '').trim().replace(/\/$/, '')
}

function resolveCrmAuthGatewayToken(env = process.env) {
  return (
    String(env.SMS_MODULE_GATEWAY_TOKEN ?? '').trim() ||
    String(env.CRM_SMS_GATEWAY_TOKEN ?? '').trim() ||
    String(env.SMS_HTTP_GATEWAY_TOKEN ?? '').trim() ||
    String(env.SMS_GATEWAY_TOKEN ?? '').trim() ||
    String(env.SMS_GATEWAY_API_KEY ?? '').trim()
  )
}

function isAligoCredentialsConfigured(env = process.env) {
  return Boolean(
    String(env.ALIGO_API_KEY ?? '').trim() &&
      String(env.ALIGO_USER_ID ?? '').trim() &&
      String(env.ALIGO_SENDER ?? '').trim(),
  )
}

function isCrmAuthGatewayConfigured(env = process.env) {
  return Boolean(
    resolveCrmAuthGatewayBaseUrl(env) &&
      resolveCrmAuthGatewayToken(env) &&
      isAligoCredentialsConfigured(env),
  )
}

function isLegacyHttpGatewayConfigured(env = process.env) {
  return Boolean(String(env.SMS_HTTP_GATEWAY_URL ?? '').trim())
}

function isGatewayConfigured(env = process.env) {
  return isCrmAuthGatewayConfigured(env) || isLegacyHttpGatewayConfigured(env)
}

/**
 * 운영 인증 SMS gateway endpoint — 단체문자 성공 경로(CRM) 우선, 레거시 sms-server 폴백.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ mode: 'crm', url: string, endpointPath: string } | { mode: 'legacy', url: string, endpointPath: string } | null}
 */
export function resolveAuthSmsGatewayEndpoint(env = process.env) {
  if (isCrmAuthGatewayConfigured(env)) {
    const base = resolveCrmAuthGatewayBaseUrl(env)
    return { mode: 'crm', url: `${base}/send`, endpointPath: '/send' }
  }
  if (isLegacyHttpGatewayConfigured(env)) {
    const url = String(env.SMS_HTTP_GATEWAY_URL ?? '').trim()
    try {
      const parsed = new URL(url)
      return { mode: 'legacy', url, endpointPath: parsed.pathname || '/send-sms' }
    } catch {
      return { mode: 'legacy', url, endpointPath: '/send-sms' }
    }
  }
  return null
}

function resolveGatewayHealthUrl(env = process.env) {
  const explicit = String(
    env.SMS_HTTP_GATEWAY_HEALTH_URL ?? env.SMS_MODULE_GATEWAY_HEALTH_URL ?? '',
  ).trim()
  if (explicit) {
    return explicit
  }
  const authEndpoint = resolveAuthSmsGatewayEndpoint(env)
  if (authEndpoint?.mode === 'crm') {
    const base = resolveCrmAuthGatewayBaseUrl(env)
    return base ? `${base}/health` : null
  }
  if (SMS_HTTP_GATEWAY_URL) {
    try {
      const u = new URL(SMS_HTTP_GATEWAY_URL)
      return `${u.origin}/health`
    } catch {
      return null
    }
  }
  return null
}

async function checkSmsGatewayHealth() {
  if (!SMS_GATEWAY_HEALTH_CHECK) {
    return { ok: true }
  }
  const url = resolveGatewayHealthUrl()
  if (!url) {
    return { ok: true }
  }
  try {
    const res = await axios.get(url, {
      timeout: HEALTH_CHECK_TIMEOUT_MS,
      validateStatus: () => true,
    })
    if (res.status >= 200 && res.status < 300) {
      const st = res.data?.status
      if (st === undefined || String(st).toLowerCase() === 'ok') {
        return { ok: true }
      }
    }
    return { ok: false }
  } catch {
    return { ok: false }
  }
}

export function isSmsProviderConfigured() {
  if (isGatewayConfigured()) {
    return true
  }
  return isAligoCredentialsConfigured()
}

function resolveLegacyGatewayAuthToken(env = process.env) {
  return (
    String(env.SMS_HTTP_GATEWAY_TOKEN ?? '').trim() ||
    String(env.SMS_GATEWAY_TOKEN ?? '').trim() ||
    String(env.SMS_GATEWAY_API_KEY ?? '').trim()
  )
}

/**
 * 단체문자 CRM gateway 와 동일한 Authorization 헤더 (server/sms import 없이 복제).
 * @param {NodeJS.ProcessEnv} [env]
 */
export function buildAuthSmsGatewayHeaders(env = process.env) {
  const endpoint = resolveAuthSmsGatewayEndpoint(env)
  if (endpoint?.mode === 'crm') {
    const token = resolveCrmAuthGatewayToken(env)
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }
  const headers = { 'Content-Type': 'application/json' }
  const token = resolveLegacyGatewayAuthToken(env)
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

/** EUC-KR byte 길이 근사 — 단체문자 gateway message_type 과 동일 기준 */
function estimateAuthSmsByteLength(text) {
  let bytes = 0
  for (const ch of String(text ?? '')) {
    const code = ch.charCodeAt(0)
    bytes += code <= 0x7f ? 1 : 2
  }
  return bytes
}

function resolveAuthSmsMessageType(message) {
  return estimateAuthSmsByteLength(message) <= 90 ? 'SMS' : 'LMS'
}

/**
 * 운영 인증 SMS gateway body — CRM 모드는 단체문자 성공 contract, 레거시는 phone/message.
 * @param {{ phone: string, message: string, purpose?: string }} params
 * @param {NodeJS.ProcessEnv} [env]
 */
export function buildAuthSmsGatewayPayload({ phone, message, purpose }, env = process.env) {
  const endpoint = resolveAuthSmsGatewayEndpoint(env)
  if (endpoint?.mode === 'crm') {
    return {
      provider: 'aligo',
      user_id: String(env.ALIGO_USER_ID ?? '').trim(),
      api_key: String(env.ALIGO_API_KEY ?? '').trim(),
      sender: String(env.ALIGO_SENDER ?? '').trim(),
      receiver: String(phone ?? '').trim(),
      message: String(message ?? '').trim(),
      message_type: resolveAuthSmsMessageType(String(message ?? '')),
      testmode_yn: 'N',
    }
  }
  return {
    phone: String(phone ?? '').trim(),
    message: String(message ?? '').trim(),
    purpose: String(purpose ?? '').trim(),
  }
}

/**
 * 필수 인증 SMS provider 선택 — gateway URL이 있으면 기본 gateway 우선.
 * Railway에서 Aligo 직접 발송은 AUTH_SMS_PROVIDER=aligo 명시 시에만 허용한다.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveAuthSmsProvider(env = process.env) {
  const authProviderRaw = String(env.AUTH_SMS_PROVIDER ?? '').trim()
  const authProvider = authProviderRaw.toLowerCase()
  const aligoConfigured = isAligoCredentialsConfigured(env)
  const gatewayConfigured = isGatewayConfigured(env)

  if (authProvider === 'aligo') {
    if (aligoConfigured) {
      return { provider: 'aligo', aligoConfigured, gatewayConfigured }
    }
    return {
      provider: null,
      aligoConfigured,
      gatewayConfigured,
      errorCode: 'aligo_unconfigured',
      errorMessage: 'AUTH_SMS_PROVIDER=aligo but Aligo credentials are missing',
    }
  }

  if (authProvider === 'gateway' || !authProvider) {
    if (gatewayConfigured) {
      return { provider: 'gateway', aligoConfigured, gatewayConfigured }
    }
    return {
      provider: null,
      aligoConfigured,
      gatewayConfigured,
      errorCode: 'gateway_unconfigured',
      errorMessage: 'SMS gateway is not configured for auth SMS',
    }
  }

  return {
    provider: null,
    aligoConfigured,
    gatewayConfigured,
    errorCode: 'invalid_auth_sms_provider',
    errorMessage: `Unsupported AUTH_SMS_PROVIDER: ${authProviderRaw}`,
  }
}

function authProviderEnvLabel(env = process.env) {
  const raw = String(env.AUTH_SMS_PROVIDER ?? '').trim()
  return raw || 'default'
}

/**
 * @param {unknown} body
 * @returns {string | null}
 */
function extractGatewayProviderMessageId(body) {
  if (!body || typeof body !== 'object') {
    return null
  }
  /** @type {Record<string, unknown>} */
  const root = /** @type {Record<string, unknown>} */ (body)
  const nested = root.data && typeof root.data === 'object' ? /** @type {Record<string, unknown>} */ (root.data) : null
  const candidates = [
    root.providerMessageId,
    root.provider_message_id,
    root.messageId,
    root.msg_id,
    root.mid,
    root.externalId,
    nested?.providerMessageId,
    nested?.provider_message_id,
    nested?.messageId,
    nested?.msg_id,
    nested?.mid,
    nested?.externalId,
    root.result && typeof root.result === 'object'
      ? /** @type {Record<string, unknown>} */ (root.result).msg_id
      : null,
    root.result && typeof root.result === 'object'
      ? /** @type {Record<string, unknown>} */ (root.result).messageId
      : null,
  ]
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim()
    if (value) {
      return value
    }
  }
  return null
}

/**
 * HTTP SMS gateway 응답 — provider 접수 증거가 있을 때만 accepted.
 * EC2 gateway가 Aligo raw 응답을 그대로 전달하는 경우도 normalize 한다.
 * @param {unknown} body
 */
export function evaluateGatewayDispatchAcceptance(body) {
  /** @type {Record<string, unknown>} */
  const root = body && typeof body === 'object' ? /** @type {Record<string, unknown>} */ (body) : {}
  const nested = root.data && typeof root.data === 'object' ? /** @type {Record<string, unknown>} */ (root.data) : null
  const resultNested =
    root.result && typeof root.result === 'object' ? /** @type {Record<string, unknown>} */ (root.result) : null

  for (const candidate of [root, nested, resultNested]) {
    if (!candidate || candidate.result_code == null) {
      continue
    }
    const aligoEval = evaluateAligoDispatchAcceptance(candidate)
    if (aligoEval.accepted) {
      return {
        accepted: true,
        provider: 'gateway',
        providerMessageId: aligoEval.providerMessageId,
        resultCode: aligoEval.resultCode,
        successCount: aligoEval.successCount,
      }
    }
    return {
      accepted: false,
      provider: 'gateway',
      errorCode: aligoEval.errorCode,
      errorMessage: aligoEval.errorMessage,
    }
  }

  const providerMessageId = extractGatewayProviderMessageId(body)
  if (providerMessageId) {
    const resultCode = Number(root.result_code)
    const successCount = Number(root.success_cnt ?? 0)
    return {
      accepted: true,
      provider: 'gateway',
      providerMessageId,
      ...(Number.isFinite(resultCode) ? { resultCode } : {}),
      ...(Number.isFinite(successCount) ? { successCount } : {}),
    }
  }

  const resultCode = Number(root.result_code ?? nested?.result_code)
  if (Number.isFinite(resultCode) && resultCode > 0) {
    return {
      accepted: false,
      provider: 'gateway',
      errorCode: resultCode,
      errorMessage: 'gateway_no_msg_id',
    }
  }
  return {
    accepted: false,
    provider: 'gateway',
    errorCode: root.errorCode ?? root.result_code ?? nested?.result_code,
    errorMessage:
      String(
        root.errorMessage ??
          root.message ??
          root.error ??
          nested?.message ??
          nested?.error ??
          '',
      ).trim() || 'gateway_no_acceptance_evidence',
  }
}

/**
 * Aligo apis.aligo.in/send 응답 — result_code·success_cnt·msg_id 모두 확인.
 * @param {unknown} body
 */
export function evaluateAligoDispatchAcceptance(body) {
  /** @type {Record<string, unknown>} */
  const root = body && typeof body === 'object' ? /** @type {Record<string, unknown>} */ (body) : {}
  const resultCode = Number(root.result_code)
  const successCount = Number(root.success_cnt ?? 0)
  const providerMessageId = String(root.msg_id ?? '').trim()
  const accepted =
    Number.isFinite(resultCode) && resultCode > 0 && successCount > 0 && Boolean(providerMessageId)

  if (accepted) {
    return {
      accepted: true,
      provider: 'aligo',
      providerMessageId,
      resultCode,
      successCount,
    }
  }
  return {
    accepted: false,
    provider: 'aligo',
    errorCode: root.result_code,
    errorMessage: String(root.message ?? '').trim() || 'aligo_reject',
  }
}

/**
 * @param {unknown} smsResult
 */
export function isAuthSmsProviderAccepted(smsResult) {
  return (
    smsResult?.success === true &&
    smsResult?.sent === true &&
    Boolean(String(smsResult?.providerMessageId ?? '').trim())
  )
}

function logAuthProviderSelected(purposeNorm, selection) {
  if (!isServiceAuthSmsPurpose(purposeNorm)) {
    return
  }
  console.info('[service-auth-sms] provider selected', {
    provider: selection.provider,
    purpose: purposeNorm,
    authProvider: authProviderEnvLabel(),
    aligoConfigured: selection.aligoConfigured,
    gatewayConfigured: selection.gatewayConfigured,
  })
}

function logAuthDispatchFailed(purposeNorm, payload) {
  if (!isServiceAuthSmsPurpose(purposeNorm)) {
    return
  }
  console.error('[service-auth-sms] dispatch failed', payload)
}

function logAuthGatewayDispatchFailed(purposeNorm, payload) {
  if (!isServiceAuthSmsPurpose(purposeNorm)) {
    return
  }
  console.error('[service-auth-sms] gateway dispatch failed', payload)
}

function logAuthGatewayRequestContract(purposeNorm, endpoint, headers, payload) {
  if (!isServiceAuthSmsPurpose(purposeNorm)) {
    return
  }
  console.info('[service-auth-sms] gateway request contract', {
    purpose: purposeNorm,
    gatewayMode: endpoint?.mode ?? 'unknown',
    endpointPath: endpoint?.endpointPath ?? 'unknown',
    headerKeys: Object.keys(headers ?? {}),
    bodyKeys: Object.keys(payload ?? {}),
  })
}

/**
 * @param {{ phoneNumber: string, code: string, purpose: string, clientIp?: string }} params
 * @returns {Promise<{ success: boolean, ok?: boolean, sent?: boolean, provider?: string, providerMessageId?: string, resultCode?: number, successCount?: number, test?: boolean, testRecipient?: boolean, mocked?: boolean, skipped?: boolean, reason?: string, data?: unknown, error?: unknown, errorCode?: unknown, errorMessage?: string, publicMessage?: string, retryAfterSec?: number }>}
 */
export async function sendVerificationCode({ phoneNumber, code, purpose, clientIp = '' }) {
  const receiver = normalizePhoneNumber(phoneNumber)
  const purposeNorm = String(purpose ?? '')
  const messageGateway = `인증번호는 ${code} 입니다.`
  const messageAligo = `[인증번호] ${code} (3분 이내 입력해주세요)`
  const ip = String(clientIp ?? '').trim()

  const finalizeFail = async (status, channel) => {
    logSmsDelivery({
      phone: receiver,
      ip,
      status,
      purpose: purposeNorm,
      channel,
    })
    await recordSmsSendFailure()
  }
  const finalizeOk = async (channel) => {
    logSmsDelivery({
      phone: receiver,
      ip,
      status: 'ok',
      purpose: purposeNorm,
      channel,
    })
    await recordSmsSendSuccess()
  }

  const circuit = await assertSmsCircuitClosed()
  if (!circuit.allowed) {
    logSmsDelivery({
      phone: receiver,
      ip,
      status: 'circuit_open',
      purpose: purposeNorm,
      channel: 'policy',
    })
    return {
      success: false,
      sent: false,
      publicMessage: SMS_PUBLIC_DELAY_MESSAGE,
      retryAfterSec: circuit.retryAfterSec,
    }
  }

  const smsPolicy = resolveSmsSendPolicy(receiver, purposeNorm)
  const isAuthPurpose = isServiceAuthSmsPurpose(purposeNorm)
  const authProviderSelection = isAuthPurpose ? resolveAuthSmsProvider() : null

  if (isAuthPurpose && authProviderSelection) {
    logAuthProviderSelected(purposeNorm, authProviderSelection)
    if (!authProviderSelection.provider) {
      await finalizeFail(String(authProviderSelection.errorCode ?? 'provider_unconfigured'), 'policy')
      logAuthDispatchFailed(purposeNorm, {
        provider: null,
        errorCode: authProviderSelection.errorCode,
        errorMessage: authProviderSelection.errorMessage,
      })
      return {
        success: false,
        sent: false,
        errorCode: authProviderSelection.errorCode,
        errorMessage: authProviderSelection.errorMessage,
        publicMessage: SMS_PUBLIC_DELAY_MESSAGE,
      }
    }
  }

  /** development 화이트리스트로 실외부 발송이 허용된 경우 성공 응답에 testRecipient 플래그를 붙인다 */
  let devApprovedTestRecipient = false
  const realDispatchOk = (base) => {
    const out = { ok: true, success: true, mocked: false, ...base }
    if (devApprovedTestRecipient === true && out.sent === true) {
      out.testRecipient = true
    }
    return out
  }

  if (smsPolicy.kind === 'mock') {
    if (isServiceAuthSmsPurpose(purposeNorm)) {
      await finalizeFail('auth_mock_blocked', 'policy')
      console.error('[service-auth-sms] blocked by dev mock policy (misconfiguration)', {
        to: maskPhone(receiver),
        purpose: purposeNorm,
        reason: smsPolicy.reason,
      })
      return {
        success: false,
        sent: false,
        publicMessage: SMS_PUBLIC_DELAY_MESSAGE,
        reason: smsPolicy.reason,
      }
    }
    logSmsDelivery({
      phone: receiver,
      ip,
      status: smsPolicy.reason,
      purpose: purposeNorm,
      channel: 'policy',
    })
    console.log('[SMS] mock success (development policy)', {
      to: maskPhone(receiver),
      purpose: purposeNorm,
      reason: smsPolicy.reason,
    })
    return {
      ok: true,
      success: true,
      sent: false,
      test: true,
      mocked: true,
      skipped: true,
      reason: smsPolicy.reason,
    }
  }

  if (smsPolicy.kind === 'allow_real_test_recipient') {
    devApprovedTestRecipient = true
  }

  const finalizeGatewayAttempt = async (response, channelLabel) => {
    if (response.status < 200 || response.status >= 300) {
      return null
    }
    const evaluation = evaluateGatewayDispatchAcceptance(response.data)
    if (!evaluation.accepted) {
      await finalizeFail(String(evaluation.errorMessage ?? 'gateway_no_acceptance'), 'http')
      const responseBody =
        response.data && typeof response.data === 'object' ? /** @type {Record<string, unknown>} */ (response.data) : {}
      logAuthGatewayDispatchFailed(purposeNorm, {
        purpose: purposeNorm,
        status: response.status,
        errorCode: evaluation.errorCode,
        errorMessage: evaluation.errorMessage,
        responseKeys: Object.keys(responseBody),
      })
      logAuthDispatchFailed(purposeNorm, {
        provider: 'gateway',
        errorCode: evaluation.errorCode,
        errorMessage: evaluation.errorMessage,
      })
      return {
        success: false,
        sent: false,
        provider: 'gateway',
        errorCode: evaluation.errorCode,
        errorMessage: evaluation.errorMessage,
        publicMessage: SMS_PUBLIC_DELAY_MESSAGE,
        data: response.data,
      }
    }
    await finalizeOk(channelLabel)
    if (isServiceAuthSmsPurpose(purposeNorm)) {
      console.info('[service-auth-sms] gateway accepted', {
        purpose: purposeNorm,
        providerMessageId: evaluation.providerMessageId,
        resultCode: evaluation.resultCode,
        successCount: evaluation.successCount,
      })
    }
    return realDispatchOk({
      sent: true,
      provider: 'gateway',
      providerMessageId: evaluation.providerMessageId,
      ...(evaluation.resultCode != null ? { resultCode: evaluation.resultCode } : {}),
      ...(evaluation.successCount != null ? { successCount: evaluation.successCount } : {}),
      data: response.data,
    })
  }

  const authGatewayEndpoint = isAuthPurpose ? resolveAuthSmsGatewayEndpoint() : null
  const shouldUseGateway = isAuthPurpose
    ? authProviderSelection?.provider === 'gateway'
    : Boolean(SMS_HTTP_GATEWAY_URL)

  if (shouldUseGateway) {
    const gatewayUrl = isAuthPurpose
      ? authGatewayEndpoint?.url
      : SMS_HTTP_GATEWAY_URL
    if (!gatewayUrl) {
      await finalizeFail('gateway_unconfigured', 'http')
      return { success: false, sent: false, publicMessage: SMS_PUBLIC_DELAY_MESSAGE }
    }

    if (SMS_GATEWAY_HEALTH_CHECK) {
      const h = await checkSmsGatewayHealth()
      if (!h.ok) {
        await finalizeFail('gateway_health_fail', 'http')
        return { success: false, sent: false, publicMessage: SMS_PUBLIC_DELAY_MESSAGE }
      }
    }

    const gatewayPayload = isAuthPurpose
      ? buildAuthSmsGatewayPayload({ phone: receiver, message: messageGateway, purpose: purposeNorm })
      : { phone: receiver, message: messageGateway }
    const gatewayHeaders = isAuthPurpose
      ? buildAuthSmsGatewayHeaders()
      : buildAuthSmsGatewayHeaders(process.env)

    if (isAuthPurpose) {
      logAuthGatewayRequestContract(purposeNorm, authGatewayEndpoint, gatewayHeaders, gatewayPayload)
    }

    const runOnce = () => {
      assertExternalSideEffectAllowed('sms.gateway.send')
      return axios.post(gatewayUrl, gatewayPayload, {
        headers: gatewayHeaders,
        timeout: SMS_SEND_TIMEOUT_MS,
        validateStatus: () => true,
      })
    }

    let response
    try {
      response = await runOnce()
    } catch (err) {
      await sleep(RETRY_DELAY_MS)
      logSmsRetry({ channel: 'http', purpose: purposeNorm, attempt: 2 })
      try {
        response = await runOnce()
      } catch (err2) {
        await finalizeFail('gateway_error', 'http')
        return {
          success: false,
          sent: false,
          provider: 'gateway',
          error: err2,
          publicMessage: SMS_PUBLIC_DELAY_MESSAGE,
        }
      }
    }

    if (response.status >= 200 && response.status < 300) {
      const gatewayResult = await finalizeGatewayAttempt(response, 'http')
      if (gatewayResult) {
        return gatewayResult
      }
    }

    await sleep(RETRY_DELAY_MS)
    logSmsRetry({ channel: 'http', purpose: purposeNorm, attempt: 2 })
    try {
      response = await runOnce()
    } catch (err) {
      await finalizeFail('gateway_error', 'http')
      return { success: false, sent: false, provider: 'gateway', error: err, publicMessage: SMS_PUBLIC_DELAY_MESSAGE }
    }

    if (response.status >= 200 && response.status < 300) {
      const gatewayResult = await finalizeGatewayAttempt(response, 'http_retry')
      if (gatewayResult) {
        return gatewayResult
      }
    }

    await finalizeFail('gateway_reject', 'http')
    logAuthDispatchFailed(purposeNorm, {
      provider: 'gateway',
      errorCode: response.status,
      errorMessage: 'gateway_reject',
    })
    return {
      success: false,
      sent: false,
      provider: 'gateway',
      errorCode: response.status,
      errorMessage: 'gateway_reject',
      data: response.data,
      publicMessage: SMS_PUBLIC_DELAY_MESSAGE,
    }
  }

  /**
   * ALIGO_TEST_MODE 가 Y/true/1 등이면 이 분기에서 실제 apis.aligo.in 호출을 하지 않는다(운영 검증 단계 포함).
   * 필수 인증 SMS(SIGNUP 등)는 이 skip 분기를 타지 않고 provider 로 실제 발송을 시도한다.
   */
  if (isAligoTestModeOn() && !isAuthPurpose) {
    await finalizeOk('test_mode')
    if (IS_PRODUCTION) {
      console.log('[SMS TEST MODE] production — not sent', {
        to: maskPhone(receiver),
        purpose: purposeNorm,
      })
    } else {
      console.log('[SMS TEST MODE] not sent', { to: maskPhone(receiver), purpose: purposeNorm })
    }
    return { success: true, test: true, sent: true }
  }

  const aligoReady = isAuthPurpose ? isAligoCredentialsConfigured() : isSmsProviderConfigured()
  if (!aligoReady) {
    await finalizeFail('provider_unconfigured', 'aligo')
    if (isAuthPurpose) {
      logAuthDispatchFailed(purposeNorm, {
        provider: 'aligo',
        errorCode: 'aligo_unconfigured',
        errorMessage: 'Aligo credentials are missing for auth SMS',
      })
    } else {
      console.warn('[smsService] SMS provider not configured (gateway URL or Aligo env)')
    }
    return { success: false, sent: false, publicMessage: SMS_PUBLIC_DELAY_MESSAGE }
  }

  const runAligo = () => {
    assertExternalSideEffectAllowed('sms.aligo.send')
    const body = new URLSearchParams({
      key: String(ALIGO_API_KEY),
      user_id: String(ALIGO_USER_ID),
      sender: String(ALIGO_SENDER),
      receiver,
      msg: messageAligo,
      testmode_yn: aligoFormTestmodeYn(),
    })
    return axios.post(ALIGO_URL, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      maxBodyLength: Infinity,
      timeout: SMS_SEND_TIMEOUT_MS,
    })
  }

  const fetchAligoData = async () => {
    const response = await runAligo()
    return response.data
  }

  const finalizeAligoAttempt = async (data, channelLabel) => {
    const evaluation = evaluateAligoDispatchAcceptance(data)
    if (!evaluation.accepted) {
      await finalizeFail('aligo_reject', 'aligo')
      logAuthDispatchFailed(purposeNorm, {
        provider: 'aligo',
        errorCode: evaluation.errorCode,
        errorMessage: evaluation.errorMessage,
      })
      console.error('[smsService] SMS send failed:', {
        result_code: evaluation.errorCode,
        purpose: purposeNorm,
        to: maskPhone(receiver),
      })
      return {
        success: false,
        sent: false,
        provider: 'aligo',
        errorCode: evaluation.errorCode,
        errorMessage: evaluation.errorMessage,
        data,
        publicMessage: SMS_PUBLIC_DELAY_MESSAGE,
      }
    }
    await finalizeOk(channelLabel)
    if (isServiceAuthSmsPurpose(purposeNorm)) {
      console.info('[service-auth-sms] aligo accepted', {
        resultCode: evaluation.resultCode,
        successCount: evaluation.successCount,
        providerMessageId: evaluation.providerMessageId,
      })
    }
    return realDispatchOk({
      sent: true,
      provider: 'aligo',
      providerMessageId: evaluation.providerMessageId,
      resultCode: evaluation.resultCode,
      successCount: evaluation.successCount,
      data,
    })
  }

  try {
    let data = await fetchAligoData()
    let aligoResult = await finalizeAligoAttempt(data, 'aligo')
    if (aligoResult.success) {
      return aligoResult
    }
    await sleep(RETRY_DELAY_MS)
    logSmsRetry({ channel: 'aligo', purpose: purposeNorm, attempt: 2 })
    data = await fetchAligoData()
    aligoResult = await finalizeAligoAttempt(data, 'aligo_retry')
    if (aligoResult.success) {
      return aligoResult
    }
    return aligoResult
  } catch (error) {
    try {
      await sleep(RETRY_DELAY_MS)
      logSmsRetry({ channel: 'aligo', purpose: purposeNorm, attempt: 2 })
      const data = await fetchAligoData()
      const aligoResult = await finalizeAligoAttempt(data, 'aligo_retry')
      if (aligoResult.success) {
        return aligoResult
      }
      return aligoResult
    } catch (err2) {
      await finalizeFail('aligo_error', 'aligo')
      const msg = err2 instanceof Error ? err2.message : String(err2)
      logAuthDispatchFailed(purposeNorm, {
        provider: 'aligo',
        errorMessage: msg,
      })
      console.error('[smsService] SMS API error:', msg)
      return {
        success: false,
        sent: false,
        provider: 'aligo',
        error: err2,
        errorMessage: msg,
        publicMessage: SMS_PUBLIC_DELAY_MESSAGE,
      }
    }
  }
}
