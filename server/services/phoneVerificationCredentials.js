import { resolveAuthSmsGatewayEndpoint, resolveAuthSmsProvider } from './smsService.js'

function normalizeBooleanEnv(raw) {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
  return s === '1' || s === 'TRUE' || s === 'YES' || s === 'Y' || s === 'ON' || s === 'T'
}

function readAligoEnvCredentials(env = process.env) {
  const userId = String(env.ALIGO_USER_ID ?? '').trim()
  const apiKey = String(env.ALIGO_API_KEY ?? '').trim()
  const sender = String(env.ALIGO_SENDER ?? '').trim()
  return { userId, apiKey, sender }
}

function isAligoEnvCredentialsReady(env = process.env) {
  const { userId, apiKey, sender } = readAligoEnvCredentials(env)
  return Boolean(userId && apiKey && sender)
}

function resolveAuthSmsProviderLabel(env = process.env) {
  const raw = String(env.AUTH_SMS_PROVIDER ?? '').trim()
  return raw ? raw.toLowerCase() : 'default'
}

function isAuthSmsDryRunFlagOn(env = process.env) {
  const raw = String(env.ALIGO_TEST_MODE ?? 'Y').trim()
  const effective = raw === '' ? 'Y' : raw
  const u = effective.toUpperCase()
  return u === 'Y' || u === 'TRUE' || u === 'T' || u === '1' || u === 'YES' || u === 'ON'
}

function isSignupPhoneVerificationEnabled(env = process.env) {
  return String(env.SIGNUP_PHONE_VERIFICATION_REQUIRED ?? 'true').trim().toLowerCase() !== 'false'
}

function isPasswordResetPhoneVerificationEnabled() {
  return true
}

function isCrmAuthGatewayEnvConfigured(env = process.env) {
  const url = String(env.SMS_MODULE_GATEWAY_URL ?? '').trim()
  const token =
    String(env.SMS_MODULE_GATEWAY_TOKEN ?? '').trim() ||
    String(env.CRM_SMS_GATEWAY_TOKEN ?? '').trim() ||
    String(env.SMS_HTTP_GATEWAY_TOKEN ?? '').trim() ||
    String(env.SMS_GATEWAY_TOKEN ?? '').trim() ||
    String(env.SMS_GATEWAY_API_KEY ?? '').trim()
  return Boolean(url && token)
}

function isLegacyAuthGatewayEnvConfigured(env = process.env) {
  return Boolean(String(env.SMS_HTTP_GATEWAY_URL ?? '').trim())
}

/**
 * Gateway rollback 경로에서만 필요한 credential 검사.
 * Aligo direct 모드에서는 gateway URL/token 존재 여부를 완전성 판정에 쓰지 않는다.
 * @param {NodeJS.ProcessEnv} env
 */
export function isAuthSmsGatewayCredentialReady(env = process.env) {
  const endpoint = resolveAuthSmsGatewayEndpoint(env)
  if (!endpoint) {
    return false
  }
  if (endpoint.mode === 'crm') {
    return isCrmAuthGatewayEnvConfigured(env) && isAligoEnvCredentialsReady(env)
  }
  return isLegacyAuthGatewayEnvConfigured(env)
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{
 *   status: 'ready' | 'incomplete',
 *   reason: string | null,
 *   diagnostics: {
 *     dbConfigExists: boolean,
 *     hasUserId: boolean,
 *     hasApiKeyEncrypted: boolean,
 *     decryptSuccess: boolean,
 *     hasApiKeyResolved: boolean,
 *     hasSender: boolean,
 *     provider: string | null,
 *     dryRun: boolean,
 *     signupEnabled: boolean,
 *     passwordResetEnabled: boolean,
 *     gatewayRequired: boolean,
 *     gatewayConfigured: boolean,
 *     credentialSource: 'env',
 *   },
 * }}
 */
export function evaluatePhoneVerificationCredentials(env = process.env) {
  const { userId, apiKey, sender } = readAligoEnvCredentials(env)
  const hasUserId = Boolean(userId)
  const hasApiKeyResolved = Boolean(apiKey)
  const hasSender = Boolean(sender)
  const hasApiKeyEncrypted = false
  const decryptSuccess = hasApiKeyResolved
  const dbConfigExists = isAligoEnvCredentialsReady(env)

  const providerSelection = resolveAuthSmsProvider(env)
  const provider = providerSelection.provider
  const authProviderRaw = String(env.AUTH_SMS_PROVIDER ?? '').trim().toLowerCase()
  const gatewayRequired = authProviderRaw === 'gateway' || provider === 'gateway'
  const gatewayConfigured = gatewayRequired ? isAuthSmsGatewayCredentialReady(env) : false

  const diagnostics = {
    dbConfigExists,
    hasUserId,
    hasApiKeyEncrypted,
    decryptSuccess,
    hasApiKeyResolved,
    hasSender,
    provider: provider ?? (authProviderRaw === 'aligo' ? 'aligo' : authProviderRaw === 'gateway' ? 'gateway' : null),
    dryRun: isAuthSmsDryRunFlagOn(env),
    signupEnabled: isSignupPhoneVerificationEnabled(env),
    passwordResetEnabled: isPasswordResetPhoneVerificationEnabled(),
    gatewayRequired,
    gatewayConfigured,
    credentialSource: 'env',
  }

  if (authProviderRaw === 'aligo' || (!authProviderRaw && dbConfigExists)) {
    if (!dbConfigExists) {
      return {
        status: 'incomplete',
        reason: 'aligo_credentials_missing',
        diagnostics: { ...diagnostics, provider: 'aligo' },
      }
    }
    return {
      status: 'ready',
      reason: null,
      diagnostics: { ...diagnostics, provider: provider ?? 'aligo' },
    }
  }

  if (authProviderRaw === 'gateway' || provider === 'gateway') {
    if (!gatewayConfigured) {
      return {
        status: 'incomplete',
        reason: 'gateway_credentials_missing',
        diagnostics: { ...diagnostics, provider: 'gateway', gatewayRequired: true },
      }
    }
    return {
      status: 'ready',
      reason: null,
      diagnostics: { ...diagnostics, provider: 'gateway', gatewayRequired: true, gatewayConfigured: true },
    }
  }

  if (!provider) {
    return {
      status: 'incomplete',
      reason: String(providerSelection.errorCode ?? 'provider_unconfigured'),
      diagnostics,
    }
  }

  return { status: 'ready', reason: null, diagnostics }
}

/**
 * 기동 시 phone-verification credential 스냅샷 — transport/OTP 로직과 분리.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function logPhoneVerificationStartupDiagnostics(env = process.env) {
  const result = evaluatePhoneVerificationCredentials(env)
  console.info('[phone-verification] diagnostics', {
    ...result.diagnostics,
    authProvider: resolveAuthSmsProviderLabel(env),
    status: result.status,
  })
  if (result.status !== 'ready') {
    console.error('[phone-verification] credentials_incomplete', {
      reason: result.reason,
      authProvider: resolveAuthSmsProviderLabel(env),
      ...result.diagnostics,
    })
  }
}
