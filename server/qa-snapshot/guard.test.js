import assert from 'node:assert/strict'
import test from 'node:test'
import { assertDatabaseGuard, parseQaSnapshotArgs } from './guard.js'

const urls = {
  sourceUrl: 'postgres://user:secret@prod.example/db',
  destinationUrl: 'postgres://user:secret@dev.example/db',
}
const env = {
  QA_SOURCE_DB_ENVIRONMENT: 'production',
  QA_DESTINATION_DB_ENVIRONMENT: 'development',
  QA_SNAPSHOT_ALLOWED_SOURCE_GA_CODE: 'GA01',
  QA_SAFE_MODE: 'true',
  CRM_R2_OBJECT_ROOT: 'crm-platform/development/insurance/tenants/ga01',
}

test('CLI는 기본 dry-run이며 고객 수 범위를 강제한다', () => {
  const options = parseQaSnapshotArgs([
    '--source-ga-code',
    'GA01',
    '--target-user-id',
    'dev-user',
    '--limit',
    '30',
  ])
  assert.equal(options.execute, false)
  assert.equal(options.confirmDevelopment, false)
  assert.throws(() => parseQaSnapshotArgs([
    '--source-ga-code', 'GA01', '--target-user-id', 'dev-user', '--limit', '29',
  ]))
})

test('production 원본과 development 대상 및 승인 GA만 허용한다', () => {
  const options = { sourceGaCode: 'GA01', execute: true, confirmDevelopment: true }
  assert.deepEqual(assertDatabaseGuard({ ...urls, options, env }), {
    sourceTarget: 'production',
    destinationTarget: 'development',
  })
  assert.throws(() => assertDatabaseGuard({
    ...urls,
    options,
    env: { ...env, QA_DESTINATION_DB_ENVIRONMENT: 'production' },
  }))
  assert.throws(() => assertDatabaseGuard({
    ...urls,
    options: { ...options, sourceGaCode: 'OTHER' },
    env,
  }))
})

test('execute는 명시적 development 확인이 필요하다', () => {
  assert.throws(() => assertDatabaseGuard({
    ...urls,
    options: { sourceGaCode: 'GA01', execute: true, confirmDevelopment: false },
    env,
  }))
})
