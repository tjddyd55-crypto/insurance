/**
 * 개인 상담 바인더 스키마.
 * 원본 PDF는 기존 files/R2가 소유하고 material은 개인 메타데이터만 참조한다.
 */
export async function ensurePersonalBinderSchema(executor) {
  await executor.query(`
    CREATE TABLE IF NOT EXISTS personal_binder_materials (
      id BIGSERIAL PRIMARY KEY,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ga_id INTEGER NOT NULL REFERENCES ga_companies(id) ON DELETE CASCADE,
      file_id BIGINT NOT NULL REFERENCES files(id) ON DELETE RESTRICT,
      title TEXT NOT NULL,
      original_file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/pdf',
      file_size BIGINT NOT NULL DEFAULT 0,
      page_count INTEGER NOT NULL,
      checksum_sha256 TEXT,
      source_type TEXT NOT NULL DEFAULT 'personal',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT personal_binder_material_page_count_check CHECK (page_count > 0),
      CONSTRAINT personal_binder_material_source_check CHECK (source_type IN ('personal', 'official'))
    )
  `)
  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS personal_binder_material_owner_file_uk
    ON personal_binder_materials (owner_user_id, ga_id, file_id)
    WHERE deleted_at IS NULL
  `)
  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS personal_binder_material_owner_checksum_uk
    ON personal_binder_materials (owner_user_id, ga_id, checksum_sha256)
    WHERE deleted_at IS NULL AND checksum_sha256 IS NOT NULL
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS personal_binders (
      id BIGSERIAL PRIMARY KEY,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ga_id INTEGER NOT NULL REFERENCES ga_companies(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    )
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS personal_binders_owner_updated_idx
    ON personal_binders (owner_user_id, ga_id, updated_at DESC)
    WHERE deleted_at IS NULL
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS personal_binder_sections (
      id BIGSERIAL PRIMARY KEY,
      binder_id BIGINT NOT NULL REFERENCES personal_binders(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT personal_binder_section_order_check CHECK (sort_order >= 0)
    )
  `)
  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS personal_binder_sections_order_uk
    ON personal_binder_sections (binder_id, sort_order)
  `)

  await executor.query(`
    CREATE TABLE IF NOT EXISTS personal_binder_items (
      id BIGSERIAL PRIMARY KEY,
      section_id BIGINT NOT NULL REFERENCES personal_binder_sections(id) ON DELETE CASCADE,
      material_id BIGINT NOT NULL REFERENCES personal_binder_materials(id) ON DELETE RESTRICT,
      sort_order INTEGER NOT NULL,
      page_selection JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT personal_binder_item_order_check CHECK (sort_order >= 0),
      CONSTRAINT personal_binder_item_pages_check CHECK (
        page_selection IS NULL OR jsonb_typeof(page_selection) = 'array'
      )
    )
  `)
  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS personal_binder_items_order_uk
    ON personal_binder_items (section_id, sort_order)
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS personal_binder_items_material_idx
    ON personal_binder_items (material_id)
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS personal_binder_materials_owner_active_idx
    ON personal_binder_materials (owner_user_id, ga_id, updated_at DESC)
    WHERE deleted_at IS NULL
  `)
}
