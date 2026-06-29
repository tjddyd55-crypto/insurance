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

/**
 * @returns {'mock' | 'aligo'}
 */
export function getConfiguredSmsModuleProviderMode() {
  const explicit = String(process.env.SMS_MODULE_PROVIDER ?? '').trim().toLowerCase()
  if (explicit === 'mock' || explicit === 'aligo') {
    return explicit
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

/**
 * production 에서 provider 정책 위반 시 throw.
 */
export function assertSmsModuleProductionProviderPolicy() {
  if (!isSmsModuleProductionRuntime()) {
    return
  }
  const mode = String(process.env.SMS_MODULE_PROVIDER ?? '').trim().toLowerCase()
  if (mode !== 'aligo') {
    const err = new Error('sms_production_provider_required')
    err.status = 503
    err.publicMessage =
      '운영 환경에서는 SMS_MODULE_PROVIDER=aligo 설정이 필요합니다. mock provider는 사용할 수 없습니다.'
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
  const mode = String(process.env.SMS_MODULE_PROVIDER ?? '').trim().toLowerCase()
  if (mode !== 'aligo') {
    return {
      ok: false,
      message:
        'SMS_MODULE_ENABLED=true 인 production 환경에서는 SMS_MODULE_PROVIDER=aligo 가 필수입니다.',
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
 *   mode: 'mock' | 'aligo' | 'invalid';
 *   isMock: boolean;
 *   testMode: boolean;
 *   realSendEnabled: boolean;
 *   moduleEnabled: boolean;
 *   providerMisconfigured: boolean;
 * }}
 */
export function readSmsModuleRuntimeInfo() {
  if (isSmsModuleProductionRuntime()) {
    const configured = String(process.env.SMS_MODULE_PROVIDER ?? '').trim().toLowerCase()
    if (configured !== 'aligo') {
      return {
        mode: 'invalid',
        isMock: true,
        testMode: false,
        realSendEnabled: isSmsRealSendEnabled(),
        moduleEnabled: isSmsModuleEnabled(),
        providerMisconfigured: true,
      }
    }
    return {
      mode: 'aligo',
      isMock: false,
      testMode: isAligoTestModeEnabled(),
      realSendEnabled: isSmsRealSendEnabled(),
      moduleEnabled: isSmsModuleEnabled(),
      providerMisconfigured: false,
    }
  }
  const mode = getConfiguredSmsModuleProviderMode() || 'mock'
  return {
    mode,
    isMock: mode === 'mock',
    testMode: mode === 'aligo' && isAligoTestModeEnabled(),
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
  return true
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
