/** @param {import('pg').Pool | import('pg').PoolClient} executor */
export async function ensureCoverageSimulationShareSchema(executor) {
  await executor.query(`
    CREATE TABLE IF NOT EXISTS coverage_simulation_shares (
      id BIGSERIAL PRIMARY KEY,
      ga_id INTEGER NOT NULL REFERENCES ga_companies(id) ON DELETE CASCADE,
      consultation_id TEXT NOT NULL,
      share_token TEXT NOT NULL UNIQUE,
      title_snapshot TEXT NOT NULL,
      customer_id TEXT,
      customer_name_snapshot TEXT,
      scenario_name_snapshot TEXT,
      scenario_snapshot JSONB NOT NULL,
      pdf_object_key TEXT,
      created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      last_viewed_at TIMESTAMPTZ,
      view_count INTEGER NOT NULL DEFAULT 0
    )
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_coverage_simulation_shares_consultation
    ON coverage_simulation_shares (ga_id, created_by_user_id, consultation_id, created_at DESC)
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_coverage_simulation_shares_token
    ON coverage_simulation_shares (share_token)
    WHERE revoked_at IS NULL
  `)
}
