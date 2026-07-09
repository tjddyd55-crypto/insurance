import { isProductionDbTarget } from '../lib/dbEnvironmentGuard.js'

function normalizeBooleanEnv(raw) {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
  return s === '1' || s === 'TRUE' || s === 'YES' || s === 'Y' || s === 'ON' || s === 'T'
}

/**
 * CRM 문자 모듈 production 런타임 판정 (auth SMS 와 무관).
 */
export function isSmsModuleProductionRuntime() {
  const nodeEnv = String(process.env.NODE_ENV ?? '').trim().toLowerCase()
  if (nodeEnv === 'production') {
    return true
  }
  if (String(process.env.RAILWAY_ENVIRONMENT ?? '').trim()) {
    return true
  }
  const appEnv = String(process.env.APP_ENV ?? '').trim().toLowerCase()
  return appEnv === 'production'
}

export function isSmsModuleEnabled() {
  return normalizeBooleanEnv(process.env.SMS_MODULE_ENABLED)
}

export function isSmsRealSendEnabled() {
  return normalizeBooleanEnv(process.env.SMS_MODULE_REAL_SEND_ENABLED)
}

/** @default false — prod 배포 시 자동문자 스케줄러는 기본 비활성 */
export function isSmsAutomationSchedulerEnabled() {
  return normalizeBooleanEnv(process.env.SMS_AUTOMATION_SCHEDULER_ENABLED)
}

const PRODUCTION_PROVIDER_REQUIRED_MESSAGE =
  'SMS_MODULE_ENABLED=true 인 production 환경에서는 SMS_MODULE_PROVIDER=gateway 또는 aligo_gateway 또는 aligo가 필요합니다. mock은 사용할 수 없습니다.'

/**
 * @param {string | undefined | null} raw
 * @returns {'mock' | 'aligo' | 'gateway' | ''}
 */
export function normalizeSmsModuleProviderMode(raw) {
  const mode = String(raw ?? '').trim().toLowerCase()
  if (mode === 'aligo_gateway') {
    return 'gateway'
  }
  if (mode === 'mock' || mode === 'aligo' || mode === 'gateway') {
    return mode
  }
  return ''
}

/**
 * @returns {'mock' | 'aligo' | 'gateway' | ''}
 */
export function getConfiguredSmsModuleProviderMode() {
  const normalized = normalizeSmsModuleProviderMode(process.env.SMS_MODULE_PROVIDER)
  if (normalized) {
    return normalized
  }
  const nodeEnv = String(process.env.NODE_ENV ?? '').trim().toLowerCase()
  if (nodeEnv === 'test') {
    return 'mock'
  }
  if (isSmsModuleProductionRuntime()) {
    return ''
  }
  return 'mock'
}

function isProductionAllowedProviderMode(mode) {
  return mode === 'aligo' || mode === 'gateway'
}

function isGatewayProviderMode(mode) {
  return mode === 'gateway'
}

function readGatewayEnv() {
  return {
    url: String(process.env.SMS_MODULE_GATEWAY_URL ?? '').trim(),
    token: String(process.env.SMS_MODULE_GATEWAY_TOKEN ?? '').trim(),
  }
}

function isGatewayEnvConfigured() {
  const { url, token } = readGatewayEnv()
  return Boolean(url && token)
}

/**
 * production 에서 provider 정책 위반 시 throw.
 */
export function assertSmsModuleProductionProviderPolicy() {
  if (!isSmsModuleProductionRuntime()) {
    return
  }
  const normalized = normalizeSmsModuleProviderMode(process.env.SMS_MODULE_PROVIDER)
  if (!isProductionAllowedProviderMode(normalized)) {
    const err = new Error('sms_production_provider_required')
    err.status = 503
    err.publicMessage = PRODUCTION_PROVIDER_REQUIRED_MESSAGE
    throw err
  }
  if (isGatewayProviderMode(normalized) && !isGatewayEnvConfigured()) {
    const err = new Error('sms_gateway_not_configured')
    err.status = 503
    err.publicMessage =
      'CRM SMS Gateway 설정(SMS_MODULE_GATEWAY_URL, SMS_MODULE_GATEWAY_TOKEN)이 필요합니다.'
    throw err
  }
}

/**
 * 서버 기동 시 production provider 정책 검사 (SMS 모듈 활성화 시에만 fatal).
 */
export function validateSmsModuleStartupConfig() {
  if (!isSmsModuleProductionRuntime()) {
    return { ok: true }
  }
  if (!isSmsModuleEnabled()) {
    return { ok: true, note: 'SMS_MODULE_ENABLED=false — provider 검사 생략' }
  }
  const mode = normalizeSmsModuleProviderMode(process.env.SMS_MODULE_PROVIDER)
  if (!isProductionAllowedProviderMode(mode)) {
    return {
      ok: false,
      message: PRODUCTION_PROVIDER_REQUIRED_MESSAGE,
    }
  }
  if (isGatewayProviderMode(mode) && !isGatewayEnvConfigured()) {
    return {
      ok: false,
      message:
        'gateway provider 사용 시 SMS_MODULE_GATEWAY_URL 과 SMS_MODULE_GATEWAY_TOKEN 환경변수가 필수입니다.',
    }
  }
  const secret = String(process.env.SMS_CREDENTIALS_SECRET_KEY ?? '').trim()
  if (!secret) {
    return {
      ok: false,
      message: 'production CRM 문자 모듈에는 SMS_CREDENTIALS_SECRET_KEY 환경변수가 필수입니다.',
    }
  }
  return { ok: true }
}

export function assertSmsModuleFeatureEnabled() {
  if (!isSmsModuleEnabled()) {
    const err = new Error('sms_module_disabled')
    err.status = 404
    err.publicMessage = '문자 발송 기능이 아직 활성화되지 않았습니다.'
    throw err
  }
}

export function assertSmsRealSendAllowed() {
  assertSmsModuleProductionProviderPolicy()
  if (!isSmsRealSendEnabled()) {
    const err = new Error('sms_real_send_disabled')
    err.status = 403
    err.publicMessage =
      '실제 문자 발송은 아직 활성화되지 않았습니다. SMS_MODULE_REAL_SEND_ENABLED 설정 후 알리고 E2E 검증이 필요합니다.'
    throw err
  }
}

export function isAligoTestModeEnabled() {
  const raw = String(process.env.SMS_MODULE_ALIGO_TEST_MODE ?? process.env.ALIGO_TEST_MODE ?? '').trim()
  if (raw === '') {
    const appEnv = String(process.env.APP_ENV ?? '').trim().toLowerCase()
    const rail = String(process.env.RAILWAY_ENVIRONMENT_NAME ?? '').trim().toLowerCase()
    return appEnv === 'development' || rail === 'development'
  }
  const u = raw.toUpperCase()
  return u === 'Y' || u === 'TRUE' || u === 'T' || u === '1' || u === 'YES' || u === 'ON'
}

/**
 * @returns {{
 *   mode: 'mock' | 'aligo' | 'gateway' | 'invalid';
 *   isMock: boolean;
 *   usesGateway: boolean;
 *   testMode: boolean;
 *   realSendEnabled: boolean;
 *   moduleEnabled: boolean;
 *   providerMisconfigured: boolean;
 * }}
 */
export function readSmsModuleRuntimeInfo() {
  if (isSmsModuleProductionRuntime()) {
    const configured = normalizeSmsModuleProviderMode(process.env.SMS_MODULE_PROVIDER)
    if (!isProductionAllowedProviderMode(configured)) {
      return {
        mode: 'invalid',
        isMock: true,
        usesGateway: false,
        testMode: false,
        realSendEnabled: isSmsRealSendEnabled(),
        moduleEnabled: isSmsModuleEnabled(),
        providerMisconfigured: true,
      }
    }
    const gatewayMisconfigured = isGatewayProviderMode(configured) && !isGatewayEnvConfigured()
    return {
      mode: configured,
      isMock: false,
      usesGateway: configured === 'gateway',
      testMode: isAligoTestModeEnabled(),
      realSendEnabled: isSmsRealSendEnabled(),
      moduleEnabled: isSmsModuleEnabled(),
      providerMisconfigured: gatewayMisconfigured,
    }
  }
  const mode = getConfiguredSmsModuleProviderMode() || 'mock'
  return {
    mode,
    isMock: mode === 'mock',
    usesGateway: mode === 'gateway',
    testMode: (mode === 'aligo' || mode === 'gateway') && isAligoTestModeEnabled(),
    realSendEnabled: isSmsRealSendEnabled(),
    moduleEnabled: isSmsModuleEnabled(),
    providerMisconfigured: false,
  }
}

/** @deprecated use readSmsModuleRuntimeInfo — mutating 경로에서만 assert 후 사용 */
export function getSmsModuleRuntimeInfo() {
  return readSmsModuleRuntimeInfo()
}

export function canVerifySenderFromTestSend(runtime = readSmsModuleRuntimeInfo()) {
  if (runtime.isMock) {
    return false
  }
  if (runtime.testMode) {
    return false
  }
  if (!runtime.realSendEnabled) {
    return false
  }
  return runtime.mode === 'aligo' || runtime.mode === 'gateway'
}

export function getSmsOutboundServerIpHint() {
  return String(process.env.SMS_MODULE_OUTBOUND_IP_HINT ?? process.env.SMS_OUTBOUND_IP_HINT ?? '').trim()
}

/**
 * @param {unknown} connectionString
 */
export function logSmsModuleEnvironmentHint(connectionString) {
  if (!isSmsModuleEnabled()) {
    console.log('[sms-module] SMS_MODULE_ENABLED=false — CRM 문자 UI/API 비활성')
    return
  }
  const startup = validateSmsModuleStartupConfig()
  if (!startup.ok) {
    console.error(`[sms-module] startup config invalid: ${startup.message}`)
  }
  const runtime = readSmsModuleRuntimeInfo()
  console.log(
    `[sms-module] provider=${runtime.mode} testMode=${runtime.testMode} realSend=${runtime.realSendEnabled} db=${isProductionDbTarget(connectionString) ? 'production' : 'non-prod'}`,
  )
}
