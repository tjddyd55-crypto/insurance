/**
 * 외부 연동 연결 상태. 비밀은 ciphertext 한 칸에만 둔다.
 * USER: owner_scope='USER' AND user_id IS NOT NULL AND ga_id IS NULL
 * GA:   owner_scope='GA' AND ga_id IS NOT NULL AND user_id IS NULL
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 */
export async function ensureServiceIntegrationsSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_integrations (
      id BIGSERIAL PRIMARY KEY,
      owner_scope TEXT NOT NULL,
      user_id TEXT NULL REFERENCES users(id) ON DELETE CASCADE,
      ga_id INTEGER NULL REFERENCES ga_companies(id) ON DELETE CASCADE,
      provider_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'disconnected',
      last_synced_at TIMESTAMPTZ NULL,
      last_error TEXT NULL,
      credential_ciphertext TEXT NULL,
      public_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT service_integrations_owner_scope_check CHECK (
        (owner_scope = 'GA' AND ga_id IS NOT NULL AND user_id IS NULL)
        OR (owner_scope = 'USER' AND user_id IS NOT NULL AND ga_id IS NULL)
      ),
      CONSTRAINT service_integrations_status_check CHECK (
        status IN ('connected', 'disconnected', 'error')
      )
    )
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_service_integrations_user_provider
    ON service_integrations (user_id, provider_key)
    WHERE owner_scope = 'USER'
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_service_integrations_ga_provider
    ON service_integrations (ga_id, provider_key)
    WHERE owner_scope = 'GA'
  `)
}
