/** @param {import('pg').Pool | import('pg').PoolClient} executor */
export async function ensurePersonalBinderShareSchema(executor) {
  await executor.query(`
    CREATE TABLE IF NOT EXISTS personal_binder_ga_shares (
      id BIGSERIAL PRIMARY KEY,
      ga_id INTEGER NOT NULL REFERENCES ga_companies(id) ON DELETE CASCADE,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_binder_id BIGINT REFERENCES personal_binders(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      share_version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      section_count INTEGER NOT NULL DEFAULT 0,
      file_count INTEGER NOT NULL DEFAULT 0,
      total_bytes BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ,
      CONSTRAINT personal_binder_ga_share_status_check CHECK (
        status IN ('creating', 'active', 'revoked', 'failed')
      )
    )
  `)
  await executor.query(`
    ALTER TABLE personal_binder_ga_shares DROP CONSTRAINT IF EXISTS personal_binder_ga_share_status_check
  `)
  await executor.query(`
    ALTER TABLE personal_binder_ga_shares
    ADD CONSTRAINT personal_binder_ga_share_status_check CHECK (
      status IN ('creating', 'active', 'revoked', 'failed')
    )
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS personal_binder_ga_shares_ga_active_idx
    ON personal_binder_ga_shares (ga_id, status, created_at DESC)
    WHERE status = 'active'
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS personal_binder_ga_shares_owner_binder_idx
    ON personal_binder_ga_shares (owner_user_id, ga_id, source_binder_id, created_at DESC)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS personal_binder_ga_share_sections (
      id BIGSERIAL PRIMARY KEY,
      share_id BIGINT NOT NULL REFERENCES personal_binder_ga_shares(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      CONSTRAINT personal_binder_ga_share_section_order_check CHECK (sort_order >= 0)
    )
  `)
  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS personal_binder_ga_share_sections_order_uk
    ON personal_binder_ga_share_sections (share_id, sort_order)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS personal_binder_ga_share_files (
      id BIGSERIAL PRIMARY KEY,
      share_id BIGINT NOT NULL REFERENCES personal_binder_ga_shares(id) ON DELETE CASCADE,
      object_key TEXT NOT NULL,
      material_title TEXT NOT NULL,
      original_file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size BIGINT NOT NULL DEFAULT 0,
      page_count INTEGER NOT NULL,
      checksum_sha256 TEXT,
      source_material_id BIGINT,
      source_file_id BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT personal_binder_ga_share_file_page_check CHECK (page_count > 0)
    )
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS personal_binder_ga_share_files_share_idx
    ON personal_binder_ga_share_files (share_id)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS personal_binder_ga_share_items (
      id BIGSERIAL PRIMARY KEY,
      share_section_id BIGINT NOT NULL REFERENCES personal_binder_ga_share_sections(id) ON DELETE CASCADE,
      share_file_id BIGINT NOT NULL REFERENCES personal_binder_ga_share_files(id) ON DELETE RESTRICT,
      sort_order INTEGER NOT NULL,
      page_selection JSONB,
      CONSTRAINT personal_binder_ga_share_item_order_check CHECK (sort_order >= 0),
      CONSTRAINT personal_binder_ga_share_item_pages_check CHECK (
        page_selection IS NULL OR jsonb_typeof(page_selection) = 'array'
      )
    )
  `)
  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS personal_binder_ga_share_items_order_uk
    ON personal_binder_ga_share_items (share_section_id, sort_order)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS personal_binder_ga_share_import_jobs (
      id BIGSERIAL PRIMARY KEY,
      share_id BIGINT NOT NULL REFERENCES personal_binder_ga_shares(id) ON DELETE RESTRICT,
      importer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ga_id INTEGER NOT NULL REFERENCES ga_companies(id) ON DELETE CASCADE,
      idempotency_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      target_binder_id BIGINT REFERENCES personal_binders(id) ON DELETE SET NULL,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      staged_object_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
      reserved_bytes BIGINT NOT NULL DEFAULT 0,
      copied_share_files JSONB NOT NULL DEFAULT '{}'::jsonb,
      CONSTRAINT personal_binder_ga_share_import_status_check CHECK (
        status IN ('pending', 'running', 'completed', 'failed', 'cancelled')
      )
    )
  `)
  await executor.query(`
    ALTER TABLE personal_binder_ga_share_import_jobs
    ADD COLUMN IF NOT EXISTS staged_object_keys JSONB NOT NULL DEFAULT '[]'::jsonb
  `)
  await executor.query(`
    ALTER TABLE personal_binder_ga_share_import_jobs
    ADD COLUMN IF NOT EXISTS reserved_bytes BIGINT NOT NULL DEFAULT 0
  `)
  await executor.query(`
    ALTER TABLE personal_binder_ga_share_import_jobs
    ADD COLUMN IF NOT EXISTS copied_share_files JSONB NOT NULL DEFAULT '{}'::jsonb
  `)
  await executor.query(`
    ALTER TABLE personal_binder_ga_share_import_jobs DROP CONSTRAINT IF EXISTS personal_binder_ga_share_import_status_check
  `)
  await executor.query(`
    ALTER TABLE personal_binder_ga_share_import_jobs
    ADD CONSTRAINT personal_binder_ga_share_import_status_check CHECK (
      status IN ('pending', 'running', 'completed', 'failed', 'cancelled')
    )
  `)
  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS personal_binder_ga_share_import_idempotency_uk
    ON personal_binder_ga_share_import_jobs (importer_user_id, ga_id, idempotency_key)
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS personal_binder_ga_share_import_share_idx
    ON personal_binder_ga_share_import_jobs (share_id, importer_user_id, created_at DESC)
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS personal_binder_ga_share_import_running_idx
    ON personal_binder_ga_share_import_jobs (share_id, status)
    WHERE status = 'running'
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS personal_binder_ga_r2_cleanup_queue (
      id BIGSERIAL PRIMARY KEY,
      object_key TEXT NOT NULL UNIQUE,
      reason TEXT NOT NULL,
      share_id BIGINT REFERENCES personal_binder_ga_shares(id) ON DELETE SET NULL,
      import_job_id BIGINT REFERENCES personal_binder_ga_share_import_jobs(id) ON DELETE SET NULL,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}
