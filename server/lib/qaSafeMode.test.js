import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertExternalSideEffectAllowed,
  assertQaStorageMutationAllowed,
  isQaSafeMode,
  validateQaSafeRuntime,
} from './qaSafeMode.js'

const SAFE_ENV = {
  QA_SAFE_MODE: 'true',
  QA_DEV_STORAGE_CONFIRMED: 'true',
  INSURANCE_DB_ENVIRONMENT: 'development',
  DATABASE_URL: 'postgresql://dev:secret@postgres.railway.internal:5432/railway',
  RAILWAY_ENVIRONMENT_NAME: 'development',
  CRM_R2_OBJECT_ROOT: 'crm-platform/development',
}

test('QA safe mode는 명시적으로만 활성화된다', () => {
  assert.equal(isQaSafeMode({}), false)
  assert.equal(isQaSafeMode({ QA_SAFE_MODE: 'true' }), true)
})

test('QA safe mode는 development DB와 storage 확인을 요구한다', () => {
  assert.deepEqual(validateQaSafeRuntime(SAFE_ENV), {
    enabled: true,
    dbTarget: 'development',
    objectRoot: 'crm-platform/development',
  })
  assert.throws(
    () => validateQaSafeRuntime({ ...SAFE_ENV, INSURANCE_DB_ENVIRONMENT: 'production' }),
    /development DB만 허용/,
  )
  assert.throws(
    () => validateQaSafeRuntime({ ...SAFE_ENV, QA_DEV_STORAGE_CONFIRMED: 'false' }),
    /QA_DEV_STORAGE_CONFIRMED/,
  )
})

test('QA safe mode는 실발송 flag와 외부 adapter를 차단한다', () => {
  assert.throws(
    () => validateQaSafeRuntime({ ...SAFE_ENV, SMS_MODULE_REAL_SEND_ENABLED: 'true' }),
    /SMS_MODULE_REAL_SEND_ENABLED/,
  )
  assert.throws(
    () => assertExternalSideEffectAllowed('toss.charge', SAFE_ENV),
    /qa_side_effect_blocked:toss.charge/,
  )
  assert.doesNotThrow(() =>
    assertQaStorageMutationAllowed('crm-platform/development/qa/file.pdf', SAFE_ENV),
  )
  assert.throws(
    () => assertQaStorageMutationAllowed('crm-platform/production/file.pdf', SAFE_ENV),
    /qa_storage_scope_blocked/,
  )
})
