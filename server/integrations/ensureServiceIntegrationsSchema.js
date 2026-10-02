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
  // 추가 칼럼만. 기존 행은 NULL 로 남는다.
  await pool.query(`
    ALTER TABLE service_integrations
      ADD COLUMN IF NOT EXISTS provider_account_email TEXT NULL,
      ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ NULL
  `)
  // OAuth 시작 한 번에 한 행. state 와 브라우저 바인딩 쿠키는 해시만 저장한다.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_integration_oauth_states (
      id BIGSERIAL PRIMARY KEY,
      state_hash TEXT NOT NULL,
      binding_hash TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_key TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_service_integration_oauth_states_hash
    ON service_integration_oauth_states (state_hash)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_service_integration_oauth_states_expires
    ON service_integration_oauth_states (expires_at)
  `)
}
