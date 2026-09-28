/**
 * Coverage Simulator — user scenario templates & saved simulations (CRM SSOT).
 * System templates remain code-only; not stored here.
 */
export async function ensureCoverageSimulatorStorageSchema(executor) {
  await executor.query(`
    CREATE TABLE IF NOT EXISTS coverage_scenario_templates (
      id BIGSERIAL PRIMARY KEY,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ga_id INTEGER NOT NULL REFERENCES ga_companies(id) ON DELETE CASCADE,
      legacy_client_id TEXT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      disease_type TEXT NOT NULL DEFAULT 'custom',
      items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT coverage_scenario_templates_name_len CHECK (char_length(name) <= 200),
      CONSTRAINT coverage_scenario_templates_items_array CHECK (jsonb_typeof(items_json) = 'array')
    )
  `)
  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS coverage_scenario_templates_legacy_uk
    ON coverage_scenario_templates (owner_user_id, ga_id, legacy_client_id)
    WHERE legacy_client_id IS NOT NULL
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS coverage_scenario_templates_owner_updated_idx
    ON coverage_scenario_templates (owner_user_id, ga_id, updated_at DESC)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS coverage_simulations (
      id BIGSERIAL PRIMARY KEY,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ga_id INTEGER NOT NULL REFERENCES ga_companies(id) ON DELETE CASCADE,
      legacy_client_id TEXT,
      customer_id TEXT,
      title TEXT NOT NULL,
      disease_type TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      template_id TEXT,
      template_name_snapshot TEXT,
      customer_name_snapshot TEXT,
      consultation_date DATE NOT NULL,
      items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT coverage_simulations_title_len CHECK (char_length(title) <= 200),
      CONSTRAINT coverage_simulations_items_array CHECK (jsonb_typeof(items_json) = 'array')
    )
  `)
  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS coverage_simulations_legacy_uk
    ON coverage_simulations (owner_user_id, ga_id, legacy_client_id)
    WHERE legacy_client_id IS NOT NULL
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS coverage_simulations_owner_updated_idx
    ON coverage_simulations (owner_user_id, ga_id, updated_at DESC)
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS coverage_simulations_owner_customer_idx
    ON coverage_simulations (owner_user_id, ga_id, customer_id)
    WHERE customer_id IS NOT NULL
  `)
}
