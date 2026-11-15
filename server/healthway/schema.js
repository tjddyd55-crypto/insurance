import { DEFAULT_RULES } from './rules.js'
export async function ensureHealthwaySchema(db) {
  if (process.env.HEALTHWAY_MODULE_ENABLED !== 'true') return
  await db.query(`
    CREATE TABLE IF NOT EXISTS healthway_requests (
      id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, ga_id BIGINT NOT NULL, customer_id BIGINT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, status TEXT NOT NULL DEFAULT 'created',
      sources JSONB NOT NULL, medical BOOLEAN NOT NULL DEFAULT false, binding_nonce_hash TEXT,
      demand_dealings_no TEXT, callback_used_at TIMESTAMPTZ, attempt_count INTEGER NOT NULL DEFAULT 0,
      consents JSONB, timeline JSONB NOT NULL DEFAULT '[]', revoked_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE INDEX IF NOT EXISTS healthway_requests_scope ON healthway_requests(owner_user_id, ga_id, customer_id);
    CREATE TABLE IF NOT EXISTS healthway_connections (
      id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, ga_id BIGINT NOT NULL, customer_id BIGINT NOT NULL,
      credentials_encrypted TEXT NOT NULL, source_status JSONB NOT NULL DEFAULT '{}',
      revoked_at TIMESTAMPTZ, connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(owner_user_id,ga_id,customer_id));
    CREATE TABLE IF NOT EXISTS healthway_transmission_demands (
      id TEXT PRIMARY KEY, connection_id TEXT NOT NULL REFERENCES healthway_connections(id) ON DELETE CASCADE,
      owner_user_id TEXT NOT NULL, ga_id BIGINT NOT NULL, customer_id BIGINT NOT NULL,
      source TEXT NOT NULL, provide_institution_no TEXT NOT NULL, transmission_demand_id TEXT,
      tokens_encrypted TEXT NOT NULL, access_token_expires_at TIMESTAMPTZ, refresh_token_expires_at TIMESTAMPTZ,
      dataset_consents JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'active', revoked_at TIMESTAMPTZ);
    CREATE TABLE IF NOT EXISTS healthway_records (
      id TEXT PRIMARY KEY, connection_id TEXT NOT NULL REFERENCES healthway_connections(id) ON DELETE CASCADE,
      owner_user_id TEXT NOT NULL, ga_id BIGINT NOT NULL, customer_id BIGINT NOT NULL,
      source TEXT NOT NULL, dataset_code TEXT NOT NULL, normalized JSONB NOT NULL, raw_encrypted TEXT NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE INDEX IF NOT EXISTS healthway_records_scope ON healthway_records(owner_user_id,ga_id,customer_id);
    CREATE TABLE IF NOT EXISTS healthway_source_coverage (
      connection_id TEXT NOT NULL REFERENCES healthway_connections(id) ON DELETE CASCADE,
      owner_user_id TEXT NOT NULL, ga_id BIGINT NOT NULL, customer_id BIGINT NOT NULL,
      source TEXT NOT NULL, dataset_code TEXT NOT NULL, coverage JSONB NOT NULL,
      PRIMARY KEY(connection_id,dataset_code));
    CREATE TABLE IF NOT EXISTS disease_code_master (
      code_raw TEXT NOT NULL, code_normalized TEXT NOT NULL, korean_name TEXT NOT NULL,
      parent_code TEXT, disease_group TEXT, version TEXT NOT NULL, source TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true, PRIMARY KEY(code_normalized,version));
    CREATE TABLE IF NOT EXISTS healthway_disease_groups (
      group_code TEXT PRIMARY KEY, name TEXT NOT NULL, codes JSONB NOT NULL DEFAULT '[]',
      version TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'admin-defined', active BOOLEAN NOT NULL DEFAULT true);
    CREATE TABLE IF NOT EXISTS medication_master (
      code_raw TEXT NOT NULL, code_system TEXT NOT NULL, name TEXT NOT NULL, ingredient_code TEXT,
      ingredient_name TEXT, class_code TEXT, class_name TEXT, version TEXT NOT NULL, source TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true, PRIMARY KEY(code_raw,code_system,version));
    CREATE TABLE IF NOT EXISTS disclosure_rules (
      rule_code TEXT PRIMARY KEY, name TEXT NOT NULL, rule_type TEXT NOT NULL, lookback_days INTEGER NOT NULL CHECK(lookback_days>0),
      min_visit_days INTEGER, min_medication_days INTEGER, disease_group TEXT, required_sources JSONB NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true, version TEXT NOT NULL);
  `)
  for (const r of DEFAULT_RULES) await db.query(`INSERT INTO disclosure_rules
    (rule_code,name,rule_type,lookback_days,min_visit_days,min_medication_days,disease_group,required_sources,enabled,version)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,true,$9) ON CONFLICT(rule_code) DO NOTHING`,
  [r.rule_code, r.name, r.rule_type, r.lookback_days, r.min_visit_days || null, r.min_medication_days || null, r.disease_group, JSON.stringify(r.required_sources), r.version])
}
