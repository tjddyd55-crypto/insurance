import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ensureServiceIntegrationsSchema } from './ensureServiceIntegrationsSchema.js'

describe('service_integrations schema ensure', () => {
  it('추가·멱등 DDL 만 쓴다 (DROP·타입 변경·NOT NULL 추가 없음)', async () => {
    const statements = []
    const pool = { query: async (sql) => { statements.push(String(sql).replace(/\s+/g, ' ').trim()); return { rows: [] } } }
    await ensureServiceIntegrationsSchema(pool)
    await ensureServiceIntegrationsSchema(pool)
    assert.ok(statements.length >= 8)
    for (const sql of statements) {
      assert.match(sql, /IF NOT EXISTS/, sql)
      assert.doesNotMatch(sql, /\bDROP\b|ALTER COLUMN|SET NOT NULL|RENAME/i, sql)
    }
    const alter = statements.find((sql) => sql.startsWith('ALTER TABLE service_integrations'))
    assert.match(alter, /ADD COLUMN IF NOT EXISTS provider_account_email TEXT NULL/)
    assert.match(alter, /ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ NULL/)
  })

  it('USER/GA owner invariant 와 USER 당 provider 1행 유니크를 유지한다', async () => {
    const statements = []
    const pool = { query: async (sql) => { statements.push(String(sql).replace(/\s+/g, ' ')); return { rows: [] } } }
    await ensureServiceIntegrationsSchema(pool)
    const all = statements.join('\n')
    assert.match(all, /owner_scope = 'GA' AND ga_id IS NOT NULL AND user_id IS NULL/)
    assert.match(all, /owner_scope = 'USER' AND user_id IS NOT NULL AND ga_id IS NULL/)
    assert.match(all, /uq_service_integrations_user_provider ON service_integrations \(user_id, provider_key\) WHERE owner_scope = 'USER'/)
    assert.match(all, /service_integration_oauth_states \( id BIGSERIAL PRIMARY KEY, state_hash TEXT NOT NULL, binding_hash TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/)
  })
})
