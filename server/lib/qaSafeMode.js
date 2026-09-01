import { classifyDbTarget } from './dbEnvironmentGuard.js'

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'y', 'on'])

function envBool(value) {
  return TRUE_VALUES.has(String(value ?? '').trim().toLowerCase())
}

export function isQaSafeMode(env = process.env) {
  return envBool(env.QA_SAFE_MODE)
}

export function assertExternalSideEffectAllowed(effect, env = process.env) {
  if (!isQaSafeMode(env)) return
  const error = new Error(`qa_side_effect_blocked:${String(effect || 'unknown')}`)
  error.code = 'QA_SIDE_EFFECT_BLOCKED'
  error.status = 503
  error.publicMessage = 'QA 환경에서는 외부 발송 및 결제를 사용할 수 없습니다.'
  throw error
}

export function assertQaStorageMutationAllowed(objectKey, env = process.env) {
  if (!isQaSafeMode(env)) return
  const root = String(env.CRM_R2_OBJECT_ROOT ?? '').trim().replace(/^\/+|\/+$/g, '')
  const key = String(objectKey ?? '').trim().replace(/^\/+/, '')
  if (!root || (key !== root && !key.startsWith(`${root}/`))) {
    const error = new Error('qa_storage_scope_blocked')
    error.code = 'QA_STORAGE_SCOPE_BLOCKED'
    error.status = 503
    throw error
  }
}

function assertDisabled(env, names) {
  const enabled = names.filter((name) => envBool(env[name]))
  if (enabled.length > 0) {
    throw new Error(`QA safe mode에서 활성화할 수 없는 설정: ${enabled.join(', ')}`)
  }
}

export function validateQaSafeRuntime(env = process.env) {
  if (!isQaSafeMode(env)) return { enabled: false }

  const dbTarget = classifyDbTarget(String(env.DATABASE_URL ?? ''), env)
  if (!['development', 'railway-development-internal', 'railway-development-public-proxy'].includes(dbTarget)) {
    throw new Error(`QA safe mode는 development DB만 허용합니다: ${dbTarget}`)
  }
  const railwayEnvironment = String(
    env.RAILWAY_ENVIRONMENT_NAME ?? env.RAILWAY_ENVIRONMENT ?? '',
  ).trim().toLowerCase()
  if (railwayEnvironment && railwayEnvironment !== 'development') {
    throw new Error(`QA safe mode Railway 환경 불일치: ${railwayEnvironment}`)
  }
  if (!envBool(env.QA_DEV_STORAGE_CONFIRMED)) {
    throw new Error('QA_DEV_STORAGE_CONFIRMED=true 설정이 필요합니다.')
  }
  const objectRoot = String(env.CRM_R2_OBJECT_ROOT ?? '').trim().toLowerCase()
  if (!objectRoot || !objectRoot.includes('development')) {
    throw new Error('QA safe mode의 CRM_R2_OBJECT_ROOT에는 development가 포함되어야 합니다.')
  }

  assertDisabled(env, [
    'SMS_MODULE_REAL_SEND_ENABLED',
    'SMS_AUTOMATION_SCHEDULER_ENABLED',
    'INSURANCE_BILLING_RENEWAL_WORKER_ENABLED',
    'INSURANCE_ALIGO_KAKAO_ALLOW_REAL_SEND',
    'INSURANCE_ALIGO_KAKAO_CLAIM_RECEIVED_ALLOW_REAL_SEND',
    'INSURANCE_ALIGO_KAKAO_CUSTOMER_REGISTRATION_COMPLETED_ALLOW_REAL_SEND',
    'INSURANCE_ALIGO_KAKAO_DEV_REAL_SEND_ENABLED',
  ])
  return { enabled: true, dbTarget, objectRoot }
}
