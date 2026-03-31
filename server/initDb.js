import pool from './db.js'

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS insurance_forms (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL DEFAULT '',
      car_number TEXT NOT NULL DEFAULT '',
      expiry_date DATE,
      form_data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  // 구버전 스키마 호환: 누락 컬럼을 보강한다.
  await pool.query(`
    ALTER TABLE insurance_forms
    ADD COLUMN IF NOT EXISTS customer_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS car_number TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS expiry_date DATE,
    ADD COLUMN IF NOT EXISTS form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `)

  await pool.query(`
    UPDATE insurance_forms
    SET updated_at = NOW()
    WHERE updated_at IS NULL
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_forms_user
    ON insurance_forms(user_id)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_forms_expiry
    ON insurance_forms(expiry_date)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_forms_user_updated
    ON insurance_forms(user_id, updated_at DESC)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS insurance_contacts (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL CHECK (category IN ('LIFE', 'NON_LIFE', 'GENERAL')),
      company_name TEXT NOT NULL,
      manager_name TEXT NOT NULL,
      position TEXT NOT NULL DEFAULT '',
      phone_number TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    ALTER TABLE insurance_contacts
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS company_name TEXT,
    ADD COLUMN IF NOT EXISTS manager_name TEXT,
    ADD COLUMN IF NOT EXISTS position TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS phone_number TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_insurance_contacts_category
    ON insurance_contacts(category, company_name, manager_name)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS insurance_contact_updates (
      id TEXT PRIMARY KEY,
      contact_id TEXT,
      action_type TEXT NOT NULL CHECK (action_type IN ('CREATE', 'UPDATE', 'DELETE')),
      category TEXT NOT NULL CHECK (category IN ('LIFE', 'NON_LIFE', 'GENERAL')),
      company_name TEXT NOT NULL,
      manager_name TEXT NOT NULL,
      position TEXT NOT NULL DEFAULT '',
      old_phone_number TEXT,
      new_phone_number TEXT,
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    ALTER TABLE insurance_contact_updates
    ADD COLUMN IF NOT EXISTS contact_id TEXT,
    ADD COLUMN IF NOT EXISTS action_type TEXT,
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS company_name TEXT,
    ADD COLUMN IF NOT EXISTS manager_name TEXT,
    ADD COLUMN IF NOT EXISTS position TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS old_phone_number TEXT,
    ADD COLUMN IF NOT EXISTS new_phone_number TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_insurance_contact_updates_created
    ON insurance_contact_updates(created_at DESC)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS insurance_contact_meta (
      meta_key TEXT PRIMARY KEY,
      meta_value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  const updatedAtColumnCheck = await pool.query(
    `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'insurance_forms'
      AND column_name = 'updated_at'
    `,
  )

  if (updatedAtColumnCheck.rowCount === 0) {
    throw new Error('DB 점검 실패: insurance_forms.updated_at 컬럼이 없습니다.')
  }

  const indexCheck = await pool.query(
    `
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'insurance_forms'
      AND indexname = 'idx_forms_user_updated'
    `,
  )

  if (
    indexCheck.rowCount === 0 ||
    !String(indexCheck.rows[0].indexdef).includes('(user_id, updated_at DESC)')
  ) {
    throw new Error('DB 점검 실패: idx_forms_user_updated 인덱스가 올바르지 않습니다.')
  }
}
