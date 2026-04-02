import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import pool from './db.js'
import {
  runCompanyDirectorySanitize,
  touchContactLastUpdatedAt,
} from './lib/companyDirectorySanitize.js'

/**
 * ⚠️ 디버그 전용: insurance_forms 등 user_id FK는 ON DELETE CASCADE 로 함께 정리됨.
 * Railway 등에서 1회 사용 후 반드시 환경변수 제거.
 */
async function maybeDebugResetAllUsers() {
  if (process.env.INSURANCE_DEBUG_RESET_ALL_USERS !== 'true') {
    return
  }

  console.warn(
    '[initDb] INSURANCE_DEBUG_RESET_ALL_USERS=true → 모든 users 삭제(CASCADE). 조치 후 변수를 꺼 주세요.',
  )
  await pool.query('DELETE FROM users')
  console.log('[initDb] 기존 users 초기화 완료')
}

/**
 * INSURANCE_ENABLE_ADMIN_BOOTSTRAP=true 일 때만 동작.
 * 없으면 super_admin으로 생성하고, 이미 있으면 비밀번호·역할을 env 기준으로 갱신한다.
 */
async function ensureBootstrapAdminUser() {
  if (process.env.INSURANCE_ENABLE_ADMIN_BOOTSTRAP !== 'true') {
    return
  }

  const username = String(process.env.INSURANCE_ADMIN_BOOTSTRAP_USERNAME || 'admin').trim()
  const password = process.env.INSURANCE_ADMIN_BOOTSTRAP_PASSWORD || '1234'
  const hash = await bcrypt.hash(password, 10)

  const existing = await pool.query(`SELECT id FROM users WHERE username = $1`, [username])

  if (existing.rowCount === 0) {
    console.log('[initDb] admin 계정 생성 시작:', username)
    const id = randomUUID()
    await pool.query(
      `
      INSERT INTO users (id, username, password_hash, role)
      VALUES ($1, $2, $3, 'super_admin')
      `,
      [id, username, hash],
    )
    console.log('[initDb] admin 생성 완료')
    return
  }

  await pool.query(
    `
    UPDATE users
    SET password_hash = $1, role = 'super_admin'
    WHERE username = $2
    `,
    [hash, username],
  )
  console.log('[initDb] admin 비밀번호·역할(super_admin) 업데이트 완료:', username)
}

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
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  `)

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT ''
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
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      ssn TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      carrier TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      height TEXT NOT NULL DEFAULT '',
      weight TEXT NOT NULL DEFAULT '',
      job TEXT NOT NULL DEFAULT '',
      driving TEXT NOT NULL DEFAULT '',
      medical TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customers_user_search
    ON customers(user_id, created_at DESC)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customers_user_id
    ON customers(user_id)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customers_search
    ON customers(user_id, name, phone)
  `)

  await pool.query(`
    ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS car_number TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS car_model TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS car_year TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS renewal_date DATE
  `)

  await pool.query(`
    ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
  `)

  await pool.query(`
    ALTER TABLE insurance_forms
    ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_forms_user_customer
    ON insurance_forms(user_id, customer_id)
    WHERE customer_id IS NOT NULL
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS insurance_company_master (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      customer_center TEXT NOT NULL DEFAULT '',
      system_phone TEXT NOT NULL DEFAULT '',
      incall_number TEXT NOT NULL DEFAULT '',
      visit_info TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS insurance_company_contacts (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES insurance_company_master(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      position TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT ''
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS insurance_general_request (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES insurance_company_master(id) ON DELETE CASCADE,
      description TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      fax TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT ''
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_insurance_company_contacts_company
    ON insurance_company_contacts(company_id)
  `)

  await pool.query(`
    ALTER TABLE insurance_company_master
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
  `)
  await pool.query(`
    ALTER TABLE insurance_company_master
    ADD COLUMN IF NOT EXISTS updated_by_username TEXT NOT NULL DEFAULT ''
  `)
  await pool.query(`
    UPDATE insurance_company_master
    SET updated_at = created_at
    WHERE updated_at IS NULL
  `)

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_insurance_general_request_company
    ON insurance_general_request(company_id)
  `)

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_insurance_company_master_category_name
    ON insurance_company_master (category, name)
  `)

  // 메리츠(화재)는 손해보험사: 잘못 LIFE로 들어간 행을 NON_LIFE로 정정 (중복 없을 때만)
  const meritzRes = await pool.query(`
    UPDATE insurance_company_master icm
    SET category = 'NON_LIFE'
    WHERE icm.category = 'LIFE'
      AND (
        icm.name = '메리츠화재'
        OR icm.name = '메리츠 화재'
        OR (icm.name LIKE '메리츠%' AND icm.name LIKE '%화재%')
        OR icm.name = '메리츠'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM insurance_company_master x
        WHERE x.category = 'NON_LIFE'
          AND TRIM(x.name) = TRIM(icm.name)
          AND x.id <> icm.id
      )
  `)
  if (meritzRes.rowCount > 0) {
    console.log('[initDb] 메리츠(화재) 분류 정정: LIFE → NON_LIFE', meritzRes.rowCount, '행')
  }

  const meritzNameCond = `
        l.name = '메리츠화재'
        OR l.name = '메리츠 화재'
        OR (l.name LIKE '메리츠%' AND l.name LIKE '%화재%')
        OR l.name = '메리츠'
  `

  await pool.query(`
    UPDATE insurance_company_contacts c
    SET company_id = n.id
    FROM insurance_company_master l
    INNER JOIN insurance_company_master n
      ON n.category = 'NON_LIFE'
      AND l.category = 'LIFE'
      AND TRIM(l.name) = TRIM(n.name)
    WHERE c.company_id = l.id
      AND (${meritzNameCond})
  `)

  await pool.query(`
    DELETE FROM insurance_general_request g
    USING insurance_company_master l
    INNER JOIN insurance_company_master n
      ON n.category = 'NON_LIFE'
      AND l.category = 'LIFE'
      AND TRIM(l.name) = TRIM(n.name)
    WHERE g.company_id = l.id
      AND (${meritzNameCond})
  `)

  const meritzDedup = await pool.query(`
    DELETE FROM insurance_company_master l
    USING insurance_company_master n
    WHERE l.category = 'LIFE'
      AND n.category = 'NON_LIFE'
      AND TRIM(l.name) = TRIM(n.name)
      AND (${meritzNameCond})
    RETURNING l.id
  `)
  if (meritzDedup.rowCount > 0) {
    console.log('[initDb] 메리츠 LIFE 중복 마스터 제거:', meritzDedup.rowCount, '행')
  }

  const meritzIc = await pool.query(`
    UPDATE insurance_contacts
    SET category = 'NON_LIFE'
    WHERE category = 'LIFE'
      AND (
        TRIM(company_name) = '메리츠화재'
        OR TRIM(company_name) = '메리츠 화재'
        OR (TRIM(company_name) LIKE '메리츠%' AND TRIM(company_name) LIKE '%화재%')
        OR TRIM(company_name) = '메리츠'
      )
  `)
  if (meritzIc.rowCount > 0) {
    console.log('[initDb] 재보험 연락처 메리츠 분류 정정: LIFE → NON_LIFE', meritzIc.rowCount, '행')
  }

  const directoryClient = await pool.connect()
  try {
    await directoryClient.query('BEGIN')
    await runCompanyDirectorySanitize(directoryClient, (msg, ...args) =>
      console.log('[initDb][company-directory]', msg, ...args),
    )
    await touchContactLastUpdatedAt(directoryClient)
    await directoryClient.query('COMMIT')
  } catch (e) {
    await directoryClient.query('ROLLBACK')
    console.error('[initDb] 보험사 디렉터리 자동 정리 실패(서버는 계속 기동):', e)
  } finally {
    directoryClient.release()
  }

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

  await maybeDebugResetAllUsers()
  await ensureBootstrapAdminUser()
}
