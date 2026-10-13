/**
 * 공유 바인더 하위 테이블 ga_id SSOT — safeQuery 테넌트 필터 및 DB 무결성.
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function ensurePersonalBinderShareGaScopeColumns(executor) {
  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS personal_binder_ga_shares_id_ga_uk
    ON personal_binder_ga_shares (id, ga_id)
  `)

  await executor.query(`
    ALTER TABLE personal_binder_ga_share_sections
    ADD COLUMN IF NOT EXISTS ga_id INTEGER REFERENCES ga_companies(id) ON DELETE CASCADE
  `)
  await executor.query(`
    UPDATE personal_binder_ga_share_sections sec
    SET ga_id = sh.ga_id
    FROM personal_binder_ga_shares sh
    WHERE sec.share_id = sh.id
      AND sec.ga_id IS DISTINCT FROM sh.ga_id
  `)

  await executor.query(`
    ALTER TABLE personal_binder_ga_share_files
    ADD COLUMN IF NOT EXISTS ga_id INTEGER REFERENCES ga_companies(id) ON DELETE CASCADE
  `)
  await executor.query(`
    UPDATE personal_binder_ga_share_files sf
    SET ga_id = sh.ga_id
    FROM personal_binder_ga_shares sh
    WHERE sf.share_id = sh.id
      AND sf.ga_id IS DISTINCT FROM sh.ga_id
  `)

  await executor.query(`
    ALTER TABLE personal_binder_ga_share_items
    ADD COLUMN IF NOT EXISTS ga_id INTEGER REFERENCES ga_companies(id) ON DELETE CASCADE
  `)
  await executor.query(`
    UPDATE personal_binder_ga_share_items it
    SET ga_id = sec.ga_id
    FROM personal_binder_ga_share_sections sec
    WHERE it.share_section_id = sec.id
      AND it.ga_id IS DISTINCT FROM sec.ga_id
  `)

  await executor.query(`
    ALTER TABLE personal_binder_ga_r2_cleanup_queue
    ADD COLUMN IF NOT EXISTS ga_id INTEGER REFERENCES ga_companies(id) ON DELETE SET NULL
  `)

  await executor.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'personal_binder_ga_share_sections_share_ga_fk'
      ) THEN
        ALTER TABLE personal_binder_ga_share_sections
        ADD CONSTRAINT personal_binder_ga_share_sections_share_ga_fk
        FOREIGN KEY (share_id, ga_id)
        REFERENCES personal_binder_ga_shares (id, ga_id)
        ON DELETE CASCADE;
      END IF;
    END $$
  `)

  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS personal_binder_ga_share_sections_id_ga_uk
    ON personal_binder_ga_share_sections (id, ga_id)
  `)

  await executor.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'personal_binder_ga_share_files_share_ga_fk'
      ) THEN
        ALTER TABLE personal_binder_ga_share_files
        ADD CONSTRAINT personal_binder_ga_share_files_share_ga_fk
        FOREIGN KEY (share_id, ga_id)
        REFERENCES personal_binder_ga_shares (id, ga_id)
        ON DELETE CASCADE;
      END IF;
    END $$
  `)

  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS personal_binder_ga_share_files_id_ga_uk
    ON personal_binder_ga_share_files (id, ga_id)
  `)

  await executor.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'personal_binder_ga_share_items_section_ga_fk'
      ) THEN
        ALTER TABLE personal_binder_ga_share_items
        ADD CONSTRAINT personal_binder_ga_share_items_section_ga_fk
        FOREIGN KEY (share_section_id, ga_id)
        REFERENCES personal_binder_ga_share_sections (id, ga_id)
        ON DELETE CASCADE;
      END IF;
    END $$
  `)

  await executor.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'personal_binder_ga_share_items_file_ga_fk'
      ) THEN
        ALTER TABLE personal_binder_ga_share_items
        ADD CONSTRAINT personal_binder_ga_share_items_file_ga_fk
        FOREIGN KEY (share_file_id, ga_id)
        REFERENCES personal_binder_ga_share_files (id, ga_id)
        ON DELETE RESTRICT;
      END IF;
    END $$
  `)
}
