import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { RAILWAY_PRODUCTION_PUBLIC_DB_HOSTS } from '../../config/dbEnvironmentTargets.js'
import { ensureGoogleSyncV2Schema, googleSyncV2SchemaStatements } from './schema.js'

describe('google-sync-v2 스키마', () => {
  it('추가·멱등 문장만 있고 행 삭제·테이블 삭제는 없다', () => {
    const statements = googleSyncV2SchemaStatements()
    const joined = statements.join('\n')
    assert.ok(statements.length > 5)
    assert.match(joined, /owner_user_id/)
    assert.match(joined, /CREATE TABLE IF NOT EXISTS external_sync_links/)
    assert.match(joined, /CREATE TABLE IF NOT EXISTS sync_outbox/)
    assert.match(joined, /ADD COLUMN IF NOT EXISTS/)
    assert.doesNotMatch(joined, /\bDROP\s+TABLE\b/i)
    assert.doesNotMatch(joined, /\bDELETE\s+FROM\b/i)
    assert.doesNotMatch(joined, /\bTRUNCATE\b/i)
    assert.doesNotMatch(joined, /CREATE TABLE IF NOT EXISTS todos/i)
  })

  it('initDb 는 플래그가 켜진 경우에만 ensure 를 호출한다', () => {
    const source = readFileSync(new URL('../../initDb.js', import.meta.url), 'utf8')
    assert.match(source, /isOnefcGoogleSyncV2Enabled\(\)/)
    assert.match(source, /ensureGoogleSyncV2Schema/)
  })

  it('운영 런타임·운영 DB·플래그 OFF 에서는 쿼리를 보내지 않는다', async () => {
    const queries = []
    const executor = {
      async query(sql) {
        queries.push(sql)
      },
    }
    const host = RAILWAY_PRODUCTION_PUBLIC_DB_HOSTS[0]
    const devOn = { NODE_ENV: 'development', RAILWAY_ENVIRONMENT: 'development', ONEFC_GOOGLE_SYNC_V2: 'true' }

    await assert.rejects(
      () => ensureGoogleSyncV2Schema(executor, { ...devOn, RAILWAY_ENVIRONMENT: 'production' }),
      (error) => error.code === 'google_sync_v2_production_runtime',
    )
    await assert.rejects(
      () => ensureGoogleSyncV2Schema(executor, { ...devOn, DATABASE_URL: `postgresql://user:pw@${host}:1/db` }),
      (error) => error.code === 'google_sync_v2_production_db' && error.message === 'google_sync_v2_production_db',
    )
    await assert.rejects(
      () => ensureGoogleSyncV2Schema(executor, { NODE_ENV: 'development', RAILWAY_ENVIRONMENT: 'development' }),
      (error) => error.code === 'google_sync_v2_disabled',
    )
    assert.equal(queries.length, 0)

    await ensureGoogleSyncV2Schema(executor, devOn)
    assert.equal(queries.length, googleSyncV2SchemaStatements().length)
  })
})
