import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import pool from './db.js'
import {
  runCompanyDirectorySanitize,
  touchContactLastUpdatedAt,
} from './lib/companyDirectorySanitize.js'
import { resolveInsuranceCategoryForApi } from './lib/insuranceCompanyCategoryResolve.js'

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

  const gaRes = await pool.query(`SELECT id FROM ga_companies WHERE code = 'YJASSET' LIMIT 1`)
  const gaId = gaRes.rows[0]?.id
  if (gaId == null) {
    throw new Error('[initDb] YJASSET GA 가 없어 bootstrap 관리자를 만들 수 없습니다.')
  }

  const existing = await pool.query(`SELECT id FROM users WHERE username = $1`, [username])

  if (existing.rowCount === 0) {
    console.log('[initDb] admin 계정 생성 시작:', username)
    const id = randomUUID()
    await pool.query(
      `
      INSERT INTO users (id, username, password_hash, role, ga_id)
      VALUES ($1, $2, $3, 'SUPER_ADMIN', $4)
      `,
      [id, username, hash, gaId],
    )
    console.log('[initDb] admin 생성 완료')
    return
  }

  await pool.query(
    `
    UPDATE users
    SET password_hash = $1, role = 'SUPER_ADMIN', ga_id = $3
    WHERE username = $2
    `,
    [hash, username, gaId],
  )
  console.log('[initDb] admin 비밀번호·역할(SUPER_ADMIN)·ga_id 업데이트 완료:', username)
}

function isPgUniqueViolation(err) {
  return Boolean(err && err.code === '23505')
}

function assertSafePgIdentifier(name) {
  const s = String(name)
  if (!/^[a-z][a-z0-9_]*$/i.test(s)) {
    throw new Error(`[initDb] 병합 FK 갱신: 허용되지 않는 식별자 "${s}"`)
  }
}

/**
 * insurance_company_master(id)를 company_id로 참조하는 public 테이블(pg_catalog).
 * information_schema로 열 목록만 조회하면 마스터 비참조 company_id까지 섞일 수 있어 FK 메타데이터로 한정한다.
 */
async function listChildTablesReferencingMasterCompanyId(client) {
  const { rows } = await client.query(`
    SELECT DISTINCT c.relname AS table_name
    FROM pg_constraint co
    JOIN pg_class c ON c.oid = co.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = co.conrelid AND a.attnum = co.conkey[1]
    WHERE co.contype = 'f'
      AND co.confrelid = CAST('insurance_company_master' AS regclass)
      AND n.nspname = 'public'
      AND c.relname <> 'insurance_company_master'
      AND a.attname = 'company_id'
      AND co.conkey IS NOT NULL
      AND array_length(co.conkey, 1) = 1
    ORDER BY 1
  `)
  const names = rows.map((r) => String(r.table_name))
  if (names.length === 0) {
    throw new Error(
      '[initDb] insurance_company_master 참조 company_id 자식 테이블이 0개입니다. 병합을 중단합니다.',
    )
  }
  return names
}

/**
 * (ga_id, category, name) 유니크 충돌 시 보수 병합: FK(company_id)를 유지 행으로 옮기고 중복 마스터 행 삭제.
 * 전 구간 단일 트랜잭션 — 중간 실패 시 ROLLBACK.
 */
async function mergeInsuranceCompanyMasterCategoryConflict(client, row, nextCategory) {
  const dup = await client.query(
    `
    SELECT id
    FROM insurance_company_master
    WHERE ga_id = $1
      AND category = $2
      AND TRIM(name) = TRIM($3)
      AND id <> $4
    LIMIT 1
    `,
    [row.ga_id, nextCategory, row.name, row.id],
  )
  if (dup.rowCount === 0) {
    return { merged: false, keepId: row.id, dropId: null }
  }
  const otherId = Number(dup.rows[0].id)
  const keepId = otherId
  const dropId = Number(row.id)
  console.warn('[보험사 category 충돌 병합]', {
    name: row.name,
    ga_id: row.ga_id,
    keepId,
    dropId,
    category: nextCategory,
  })

  const childTables = await listChildTablesReferencingMasterCompanyId(client)
  await client.query('BEGIN')
  try {
    for (const tableName of childTables) {
      assertSafePgIdentifier(tableName)
      await client.query(
        `UPDATE "${tableName}" SET company_id = $1 WHERE company_id = $2`,
        [keepId, dropId],
      )
    }
    await client.query(
      `
      INSERT INTO insurance_company_merge_logs (keep_id, drop_id, name, category, ga_id)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [keepId, dropId, String(row.name ?? ''), nextCategory, row.ga_id ?? null],
    )
    await client.query(`DELETE FROM insurance_company_master WHERE id = $1`, [dropId])
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  }
  return { merged: true, keepId, dropId }
}

/**
 * insurance_company_master.category를 LIFE|NON_LIFE|GENERAL로 맞추고 CHECK 제약을 둔다.
 */
async function ensureInsuranceCompanyMasterCategoryNormalized(pool) {
  const client = await pool.connect()
  const { rows } = await client.query(
    `SELECT id, ga_id, name, category FROM insurance_company_master ORDER BY id`,
  )
  const deletedIds = new Set()
  let updated = 0
  let fallbackGeneral = 0
  try {
    for (const row of rows) {
      if (deletedIds.has(Number(row.id))) {
        continue
      }
      let next = resolveInsuranceCategoryForApi(row.category, row.name)
      if (!next || !['LIFE', 'NON_LIFE', 'GENERAL'].includes(next)) {
        next = 'GENERAL'
        fallbackGeneral += 1
        console.warn('[initDb] 보험사 category 추론 불가 → GENERAL', {
          id: row.id,
          name: row.name,
          categoryWas: row.category,
        })
      }
      if (next === row.category) {
        continue
      }
      try {
        await client.query(`UPDATE insurance_company_master SET category = $1 WHERE id = $2`, [
          next,
          row.id,
        ])
        updated += 1
      } catch (e) {
        if (!isPgUniqueViolation(e)) {
          console.error('[initDb] insurance_company_master category UPDATE 실패', {
            id: row.id,
            ga_id: row.ga_id,
            name: row.name,
            next,
            message: e instanceof Error ? e.message : String(e),
          })
          continue
        }
        console.warn('[보험사 category 충돌]', row.name, 'ga_id', row.ga_id)
        const { merged, dropId } = await mergeInsuranceCompanyMasterCategoryConflict(client, row, next)
        if (merged && dropId != null) {
          deletedIds.add(dropId)
        }
        updated += 1
      }
    }
  } finally {
    client.release()
  }
  if (updated > 0) {
    console.log('[initDb] insurance_company_master category 정규화 반영:', updated, '행')
  }
  if (fallbackGeneral > 0) {
    console.warn('[initDb] insurance_company_master GENERAL 폴백:', fallbackGeneral, '행 → 데이터 점검 권장')
  }

  await pool.query(`
    ALTER TABLE insurance_company_master
    DROP CONSTRAINT IF EXISTS insurance_company_master_category_check
  `)
  await pool.query(`
    ALTER TABLE insurance_company_master
    DROP CONSTRAINT IF EXISTS category_check
  `)
  await pool.query(`
    ALTER TABLE insurance_company_master
    ADD CONSTRAINT insurance_company_master_category_check
    CHECK (category IN ('LIFE', 'NON_LIFE', 'GENERAL'))
  `)
}

/**
 * 원수사 마스터 삭제 시 담당자 행은 company_id 해제(소프트 삭제는 애플리케이션에서 처리).
 * DB 레벨 안전망: ON DELETE SET NULL
 * (ADD COLUMN … REFERENCES 로 생긴 이명 FK까지 제거 후 단일 제약으로 통일)
 */
async function ensureInsurerManagerCompanyFkOnDeleteSetNull(executor) {
  const { rows } = await executor.query(`
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class cl ON c.conrelid = cl.oid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE n.nspname = 'public'
      AND cl.relname = 'insurer_managers'
      AND c.contype = 'f'
      AND c.confrelid = CAST('insurance_company_master' AS regclass)
  `)
  for (const r of rows) {
    const name = String(r.conname ?? '').replace(/"/g, '')
    if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
      continue
    }
    await executor.query(`ALTER TABLE insurer_managers DROP CONSTRAINT IF EXISTS "${name}"`)
  }
  await executor.query(`
    ALTER TABLE insurer_managers
    ADD CONSTRAINT fk_insurer_managers_insurance_company_master
    FOREIGN KEY (company_id) REFERENCES insurance_company_master(id) ON DELETE SET NULL
  `)
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
    CREATE TABLE IF NOT EXISTS ga_companies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    ALTER TABLE ga_companies
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  `)
  await pool.query(`
    ALTER TABLE ga_companies
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false
  `)
  await pool.query(`ALTER TABLE ga_companies DROP CONSTRAINT IF EXISTS ga_companies_status_check`)
  await pool.query(`
    ALTER TABLE ga_companies
    ADD CONSTRAINT ga_companies_status_check
    CHECK (status IN ('active', 'blocked', 'inactive'))
  `)

  await pool.query(
    `
    INSERT INTO ga_companies (name, code)
    VALUES ('영진에셋', 'YJASSET')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    `,
  )

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS ga_id INTEGER REFERENCES ga_companies(id)
  `)

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  `)
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false
  `)
  await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check`)
  await pool.query(`
    ALTER TABLE users
    ADD CONSTRAINT users_status_check
    CHECK (status IN ('active', 'blocked', 'inactive', 'reset'))
  `)

  /* 휴대폰 유니크는 운영 정책 확정 후 ADD CONSTRAINT ... UNIQUE (phone_number) 등으로 붙일 수 있음 */
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20)
  `)

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_sms_requested_at TIMESTAMPTZ
  `)
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS sms_request_count INTEGER NOT NULL DEFAULT 0
  `)
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS sms_request_window_start TIMESTAMPTZ
  `)

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS sms_blocked_until TIMESTAMPTZ
  `)
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS sms_auth_failure_count INTEGER NOT NULL DEFAULT 0
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sms_verification_codes (
      id SERIAL PRIMARY KEY,
      purpose VARCHAR(50) NOT NULL,
      user_id TEXT NULL,
      username VARCHAR(100) NULL,
      phone_number VARCHAR(20) NOT NULL,
      code VARCHAR(10) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      verified_at TIMESTAMPTZ NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_verification_phone_purpose
    ON sms_verification_codes (phone_number, purpose)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_verification_user_purpose
    ON sms_verification_codes (user_id, purpose)
  `)

  await pool.query(`
    ALTER TABLE sms_verification_codes
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sms_verification_logs (
      id SERIAL PRIMARY KEY,
      user_id TEXT NULL,
      phone_number VARCHAR(20) NOT NULL,
      purpose VARCHAR(50) NOT NULL,
      success BOOLEAN NOT NULL,
      ip TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_verification_logs_created
    ON sms_verification_logs (created_at DESC)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sms_verification_logs_user_created
    ON sms_verification_logs (user_id, created_at DESC)
    WHERE user_id IS NOT NULL
  `)

  await pool.query(`
    ALTER TABLE sms_verification_logs
    ADD COLUMN IF NOT EXISTS user_agent TEXT NOT NULL DEFAULT ''
  `)

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS delegate_password_plaintext TEXT
  `)

  await pool.query(`
    UPDATE users u
    SET ga_id = g.id
    FROM ga_companies g
    WHERE g.code = 'YJASSET' AND u.ga_id IS NULL
  `)

  await pool.query(`
    UPDATE users SET role = CASE role
      WHEN 'super_admin' THEN 'SUPER_ADMIN'
      WHEN 'staff' THEN 'GA_ADMIN'
      WHEN 'user' THEN 'USER'
      WHEN 'SUPER_ADMIN' THEN 'SUPER_ADMIN'
      WHEN 'GA_ADMIN' THEN 'GA_ADMIN'
      WHEN 'GA_STAFF' THEN 'GA_STAFF'
      WHEN 'USER' THEN 'USER'
      ELSE 'USER'
    END
  `)

  const nullGaUsers = await pool.query(`SELECT COUNT(*) AS c FROM users WHERE ga_id IS NULL`)
  if ((nullGaUsers.rows[0]?.c ?? 0) > 0) {
    throw new Error('[initDb] users.ga_id 가 비어 있는 행이 있습니다.')
  }

  await pool.query(`
    ALTER TABLE users ALTER COLUMN ga_id SET NOT NULL
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS feature_requests (
      id SERIAL PRIMARY KEY,
      ga_id INTEGER NOT NULL REFERENCES ga_companies(id),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT feature_requests_status_check CHECK (status IN ('pending', 'reviewed', 'done'))
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_feature_requests_created
    ON feature_requests(created_at DESC)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_feature_requests_ga
    ON feature_requests(ga_id)
  `)

  await pool.query(`
    ALTER TABLE feature_requests
    ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT ''
  `)
  await pool.query(`
    UPDATE feature_requests
    SET title = LEFT(TRIM(content), 120)
    WHERE COALESCE(TRIM(title), '') = ''
      AND TRIM(content) <> ''
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
    ADD COLUMN IF NOT EXISTS form_data JSONB NOT NULL DEFAULT CAST('{}' AS jsonb),
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
    ADD COLUMN IF NOT EXISTS ga_id INTEGER REFERENCES ga_companies(id)
  `)
  await pool.query(`
    UPDATE customers c
    SET ga_id = u.ga_id
    FROM users u
    WHERE c.user_id = u.id AND c.ga_id IS NULL
  `)
  const nullCust = await pool.query(`SELECT COUNT(*) AS c FROM customers WHERE ga_id IS NULL`)
  if ((nullCust.rows[0]?.c ?? 0) > 0) {
    throw new Error('[initDb] customers.ga_id NULL')
  }
  await pool.query(`ALTER TABLE customers ALTER COLUMN ga_id SET NOT NULL`)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customers_ga
    ON customers(ga_id)
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
    ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS insurance_age INTEGER,
    ADD COLUMN IF NOT EXISTS next_age_date DATE,
    ADD COLUMN IF NOT EXISTS is_driver BOOLEAN,
    ADD COLUMN IF NOT EXISTS car_type TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS notes JSONB NOT NULL DEFAULT CAST('[]' AS jsonb)
  `)

  await pool.query(`
    ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE
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
    ALTER TABLE insurance_forms
    ADD COLUMN IF NOT EXISTS ga_id INTEGER REFERENCES ga_companies(id)
  `)
  await pool.query(`
    UPDATE insurance_forms f
    SET ga_id = u.ga_id
    FROM users u
    WHERE f.user_id = u.id AND f.ga_id IS NULL
  `)
  const nullForms = await pool.query(`SELECT COUNT(*) AS c FROM insurance_forms WHERE ga_id IS NULL`)
  if ((nullForms.rows[0]?.c ?? 0) > 0) {
    throw new Error('[initDb] insurance_forms.ga_id NULL')
  }
  await pool.query(`ALTER TABLE insurance_forms ALTER COLUMN ga_id SET NOT NULL`)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_insurance_forms_ga
    ON insurance_forms(ga_id)
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
    ALTER TABLE insurance_contacts
    ADD COLUMN IF NOT EXISTS ga_id INTEGER REFERENCES ga_companies(id)
  `)
  await pool.query(`
    UPDATE insurance_contacts c
    SET ga_id = g.id
    FROM ga_companies g
    WHERE g.code = 'YJASSET' AND c.ga_id IS NULL
  `)
  const nullIcGa = await pool.query(`SELECT COUNT(*) AS c FROM insurance_contacts WHERE ga_id IS NULL`)
  if ((nullIcGa.rows[0]?.c ?? 0) > 0) {
    throw new Error('[initDb] insurance_contacts.ga_id NULL')
  }
  await pool.query(`ALTER TABLE insurance_contacts ALTER COLUMN ga_id SET NOT NULL`)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_insurance_contacts_ga
    ON insurance_contacts(ga_id)
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
    ALTER TABLE insurance_contact_updates
    ADD COLUMN IF NOT EXISTS ga_id INTEGER REFERENCES ga_companies(id)
  `)
  await pool.query(`
    UPDATE insurance_contact_updates u
    SET ga_id = c.ga_id
    FROM insurance_contacts c
    WHERE u.contact_id = c.id AND u.ga_id IS NULL
  `)
  await pool.query(`
    UPDATE insurance_contact_updates u
    SET ga_id = g.id
    FROM ga_companies g
    WHERE g.code = 'YJASSET' AND u.ga_id IS NULL
  `)
  const nullIcuGa = await pool.query(`SELECT COUNT(*) AS c FROM insurance_contact_updates WHERE ga_id IS NULL`)
  if ((nullIcuGa.rows[0]?.c ?? 0) > 0) {
    throw new Error('[initDb] insurance_contact_updates.ga_id NULL')
  }
  await pool.query(`ALTER TABLE insurance_contact_updates ALTER COLUMN ga_id SET NOT NULL`)

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
    CREATE TABLE IF NOT EXISTS insurance_company_update_log (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES insurance_company_master(id) ON DELETE SET NULL,
      company_name TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by_username TEXT NOT NULL DEFAULT '',
      before_payload JSONB NOT NULL DEFAULT '{}',
      after_payload JSONB NOT NULL DEFAULT '{}'
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_insurance_company_update_log_updated
    ON insurance_company_update_log (updated_at DESC)
  `)

  /** 보험사(마스터) 삭제 후에도 콘텐츠 보존 — company_id 끊고 표시용 스냅샷 유지 */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS insurance_company_newsletters (
      id TEXT PRIMARY KEY,
      ga_id INTEGER NOT NULL REFERENCES ga_companies(id),
      company_id INTEGER REFERENCES insurance_company_master(id) ON DELETE SET NULL,
      company_name_snapshot TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'DRAFT',
      body_text TEXT NOT NULL DEFAULT '',
      payload JSONB NOT NULL DEFAULT CAST('{}' AS jsonb),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_insurance_company_newsletters_ga
    ON insurance_company_newsletters(ga_id)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_insurance_company_newsletters_company
    ON insurance_company_newsletters(company_id)
    WHERE company_id IS NOT NULL
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS insurance_company_newsletter_attachments (
      id TEXT PRIMARY KEY,
      newsletter_id TEXT NOT NULL REFERENCES insurance_company_newsletters(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      url TEXT NOT NULL,
      object_key TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes BIGINT NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_icn_att_newsletter
    ON insurance_company_newsletter_attachments(newsletter_id)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS insurance_company_merge_logs (
      id SERIAL PRIMARY KEY,
      keep_id INTEGER NOT NULL,
      drop_id INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      category TEXT,
      ga_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_insurance_company_merge_logs_created
    ON insurance_company_merge_logs (created_at DESC)
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
    ALTER TABLE insurance_company_master
    ADD COLUMN IF NOT EXISTS ga_id INTEGER REFERENCES ga_companies(id)
  `)
  await pool.query(`
    UPDATE insurance_company_master m
    SET ga_id = g.id
    FROM ga_companies g
    WHERE g.code = 'YJASSET' AND m.ga_id IS NULL
  `)
  const nullM = await pool.query(`SELECT COUNT(*) AS c FROM insurance_company_master WHERE ga_id IS NULL`)
  if ((nullM.rows[0]?.c ?? 0) > 0) {
    throw new Error('[initDb] insurance_company_master.ga_id NULL')
  }
  await pool.query(`DROP INDEX IF EXISTS uq_insurance_company_master_category_name`)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_insurance_company_master_ga_category_name
    ON insurance_company_master (ga_id, category, name)
  `)
  await pool.query(`ALTER TABLE insurance_company_master ALTER COLUMN ga_id SET NOT NULL`)

  await pool.query(`
    ALTER TABLE insurance_company_master
    ADD COLUMN IF NOT EXISTS company_code VARCHAR(20)
  `)
  await pool.query(`
    UPDATE insurance_company_master
    SET company_code = 'INS' || LPAD(CAST(id AS text), 6, '0')
    WHERE company_code IS NULL OR BTRIM(company_code) = ''
  `)
  await pool.query(`DROP INDEX IF EXISTS uq_insurance_company_master_company_code`)
  await pool.query(`
    CREATE UNIQUE INDEX uq_insurance_company_master_company_code
    ON insurance_company_master (company_code)
  `)

  await pool.query(`
    ALTER TABLE insurance_company_update_log
    ADD COLUMN IF NOT EXISTS ga_id INTEGER REFERENCES ga_companies(id)
  `)
  await pool.query(`
    UPDATE insurance_company_update_log l
    SET ga_id = m.ga_id
    FROM insurance_company_master m
    WHERE l.company_id = m.id AND l.ga_id IS NULL
  `)
  await pool.query(`
    UPDATE insurance_company_update_log l
    SET ga_id = g.id
    FROM ga_companies g
    WHERE g.code = 'YJASSET' AND l.ga_id IS NULL
  `)
  const nullLog = await pool.query(`SELECT COUNT(*) AS c FROM insurance_company_update_log WHERE ga_id IS NULL`)
  if ((nullLog.rows[0]?.c ?? 0) > 0) {
    throw new Error('[initDb] insurance_company_update_log.ga_id NULL')
  }
  await pool.query(`ALTER TABLE insurance_company_update_log ALTER COLUMN ga_id SET NOT NULL`)

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_insurance_general_request_company
    ON insurance_general_request(company_id)
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
          AND x.ga_id = icm.ga_id
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
      AND n.ga_id = l.ga_id
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
      AND n.ga_id = l.ga_id
    WHERE g.company_id = l.id
      AND (${meritzNameCond})
  `)

  const meritzDedup = await pool.query(`
    DELETE FROM insurance_company_master l
    USING insurance_company_master n
    WHERE l.category = 'LIFE'
      AND n.category = 'NON_LIFE'
      AND TRIM(l.name) = TRIM(n.name)
      AND l.ga_id = n.ga_id
      AND (${meritzNameCond})
    RETURNING l.id
  `)
  if (meritzDedup.rowCount > 0) {
    console.log('[initDb] 메리츠 LIFE 중복 마스터 제거:', meritzDedup.rowCount, '행')
  }

  await ensureInsuranceCompanyMasterCategoryNormalized(pool)

  await pool.query(`
    UPDATE insurance_company_master
    SET company_code = 'INS' || LPAD(CAST(id AS text), 6, '0')
    WHERE company_code IS NULL OR BTRIM(company_code) = ''
  `)
  const nullCompanyCode = await pool.query(`
    SELECT COUNT(*) AS c
    FROM insurance_company_master
    WHERE company_code IS NULL OR BTRIM(company_code) = ''
  `)
  if ((nullCompanyCode.rows[0]?.c ?? 0) > 0) {
    throw new Error('[initDb] insurance_company_master.company_code가 비어 있어 NOT NULL을 적용할 수 없습니다.')
  }
  await pool.query(`
    ALTER TABLE insurance_company_master
    ALTER COLUMN company_code SET NOT NULL
  `)

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

  const yjGaRes = await pool.query(`SELECT id FROM ga_companies WHERE code = 'YJASSET' LIMIT 1`)
  const yjGaId = yjGaRes.rows[0]?.id

  const directoryClient = await pool.connect()
  try {
    await directoryClient.query('BEGIN')
    await runCompanyDirectorySanitize(directoryClient, (msg, ...args) =>
      console.log('[initDb][company-directory]', msg, ...args),
      yjGaId,
    )
    await touchContactLastUpdatedAt(directoryClient, yjGaId)
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS consent_templates (
      id TEXT PRIMARY KEY,
      ga_id INTEGER NOT NULL,
      insurance_company_id TEXT NOT NULL,
      fax_number TEXT NOT NULL DEFAULT '',
      fields JSONB NOT NULL DEFAULT CAST('[]' AS jsonb),
      pdf_storage_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    WITH ranked AS (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY ga_id, insurance_company_id
          ORDER BY created_at ASC, id ASC
        ) AS rn
      FROM consent_templates
    )
    DELETE FROM consent_templates c
    USING ranked r
    WHERE c.id = r.id AND r.rn > 1
  `)

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_consent_templates_ga_insurer
    ON consent_templates(ga_id, insurance_company_id)
  `)

  await pool.query(`
    ALTER TABLE consent_templates
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `)

  const yjConsentGa = await pool.query(`SELECT id FROM ga_companies WHERE code = 'YJASSET' LIMIT 1`)
  const yjConsentGaId = yjConsentGa.rows[0]?.id
  if (yjConsentGaId != null) {
    await pool.query(
      `
      DELETE FROM consent_templates a
      USING consent_templates b
      WHERE a.ga_id IS DISTINCT FROM $1
        AND b.ga_id = $1
        AND a.insurance_company_id = b.insurance_company_id
      `,
      [yjConsentGaId],
    )
    await pool.query(`UPDATE consent_templates SET ga_id = $1 WHERE ga_id IS DISTINCT FROM $1`, [
      yjConsentGaId,
    ])
    await pool.query(`
      DELETE FROM consent_templates a
      USING consent_templates b
      WHERE a.ga_id = b.ga_id
        AND a.insurance_company_id = b.insurance_company_id
        AND CAST(a.id AS text) > CAST(b.id AS text)
    `)
  }
  await pool.query(`ALTER TABLE consent_templates DROP CONSTRAINT IF EXISTS fk_consent_templates_ga`)
  await pool.query(`
    ALTER TABLE consent_templates
    ADD CONSTRAINT fk_consent_templates_ga FOREIGN KEY (ga_id) REFERENCES ga_companies(id)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS insurer_managers (
      id TEXT PRIMARY KEY,
      ga_id INTEGER NOT NULL REFERENCES ga_companies(id),
      insurer_type TEXT NOT NULL,
      insurer_name TEXT NOT NULL,
      username VARCHAR(50) NOT NULL,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      is_deleted BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`ALTER TABLE insurer_managers DROP CONSTRAINT IF EXISTS insurer_managers_insurer_type_check`)
  await pool.query(`
    ALTER TABLE insurer_managers
    ADD CONSTRAINT insurer_managers_insurer_type_check
    CHECK (insurer_type IN ('LIFE', 'NON_LIFE'))
  `)
  await pool.query(`ALTER TABLE insurer_managers DROP CONSTRAINT IF EXISTS insurer_managers_status_check`)
  await pool.query(`
    ALTER TABLE insurer_managers
    ADD CONSTRAINT insurer_managers_status_check
    CHECK (status IN ('ACTIVE', 'BLOCKED'))
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_insurer_managers_username_active
    ON insurer_managers (username)
    WHERE is_deleted = false
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_insurer_managers_ga_insurer_active
    ON insurer_managers (ga_id, insurer_name)
    WHERE is_deleted = false
  `)

  await pool.query(`
    ALTER TABLE insurer_managers
    ADD COLUMN IF NOT EXISTS password_plaintext TEXT
  `)

  await pool.query(`
    ALTER TABLE insurer_managers
    ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES insurance_company_master(id)
  `)
  await pool.query(`
    UPDATE insurer_managers im
    SET company_id = m.id
    FROM insurance_company_master m
    WHERE im.company_id IS NULL
      AND im.ga_id = m.ga_id
      AND TRIM(im.insurer_name) = TRIM(m.name)
  `)
  await pool.query(`DROP INDEX IF EXISTS uq_insurer_managers_ga_insurer_active`)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_insurer_managers_ga_company_active
    ON insurer_managers (ga_id, company_id)
    WHERE is_deleted = false AND company_id IS NOT NULL
  `)
  await pool.query(`
    ALTER TABLE insurer_managers
    ALTER COLUMN company_id DROP NOT NULL
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS insurer_manager_recovery_logs (
      id SERIAL PRIMARY KEY,
      manager_id TEXT,
      old_company_id INTEGER,
      new_company_id INTEGER,
      recovery_type TEXT NOT NULL,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS security_audit_logs (
      id BIGSERIAL PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      ga_id INTEGER,
      company_id INTEGER,
      meta JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await ensureInsurerManagerCompanyFkOnDeleteSetNull(pool)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_insurer_manager_unique
    ON insurer_managers (ga_id, company_id, username)
    WHERE is_deleted = false
  `)

  await maybeDebugResetAllUsers()
  await ensureBootstrapAdminUser()
  await seedConsentTemplatesIfNeeded()

  await pool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      ga_id INTEGER NOT NULL REFERENCES ga_companies(id),
      name TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_teams_ga ON teams(ga_id)
  `)
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS team_id TEXT REFERENCES teams(id) ON DELETE SET NULL
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_team ON users(team_id) WHERE team_id IS NOT NULL
  `)
  await pool.query(`
    ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_user_id) WHERE owner_user_id IS NOT NULL
  `)
  await pool.query(`
    UPDATE teams t
    SET owner_user_id = u.id
    FROM (
      SELECT DISTINCT ON (team_id) team_id, id
      FROM users
      WHERE team_id IS NOT NULL AND is_deleted = false
      ORDER BY team_id, display_name ASC NULLS LAST, username ASC
    ) u
    WHERE t.id = u.team_id AND (t.owner_user_id IS NULL OR t.owner_user_id = '')
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_posts (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      author_user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      is_notice BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_team_posts_team_notice_created
    ON team_posts(team_id, is_notice DESC, created_at DESC)
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_post_attachments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES team_posts(id) ON DELETE CASCADE,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_team_post_attachments_post
    ON team_post_attachments(post_id)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_consultations (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ga_id INTEGER NOT NULL REFERENCES ga_companies(id),
      body TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_consultations_customer_created
    ON customer_consultations(customer_id, created_at DESC)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_consultations_user
    ON customer_consultations(user_id)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_relations (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      related_customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ga_id INTEGER NOT NULL REFERENCES ga_companies(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_customer_relations_distinct CHECK (customer_id <> related_customer_id)
    )
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_relations_pair
    ON customer_relations(customer_id, related_customer_id)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_relations_by_customer
    ON customer_relations(customer_id)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      ga_id INTEGER REFERENCES ga_companies(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_analytics_events_created_seoul
    ON analytics_events (CAST((created_at AT TIME ZONE 'Asia/Seoul') AS date), event_type)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_analytics_events_ga_created
    ON analytics_events (ga_id, created_at DESC)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_analytics_events_login_dau
    ON analytics_events (event_type, ga_id, CAST((created_at AT TIME ZONE 'Asia/Seoul') AS date))
    WHERE event_type = 'login'
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS analytics_daily_stats (
      id BIGSERIAL PRIMARY KEY,
      stat_date DATE NOT NULL,
      scope_type TEXT NOT NULL CHECK (scope_type IN ('overall', 'ga')),
      ga_id INTEGER REFERENCES ga_companies(id) ON DELETE CASCADE,
      total_users INT NOT NULL DEFAULT 0,
      daily_active_users INT NOT NULL DEFAULT 0,
      weekly_active_users INT NOT NULL DEFAULT 0,
      new_users INT NOT NULL DEFAULT 0,
      customers_created INT NOT NULL DEFAULT 0,
      documents_created INT NOT NULL DEFAULT 0,
      team_messages_created INT NOT NULL DEFAULT 0
    )
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_analytics_daily_overall
    ON analytics_daily_stats(stat_date)
    WHERE scope_type = 'overall'
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_analytics_daily_ga
    ON analytics_daily_stats(stat_date, ga_id)
    WHERE scope_type = 'ga'
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_analytics_daily_stat_date
    ON analytics_daily_stats(stat_date)
  `)
}

async function seedConsentTemplatesIfNeeded() {
  try {
    const { PDFDocument } = await import('pdf-lib')
    const { consentPutObject } = await import('./lib/consentStorage.js')
    const { DEFAULT_CONSENT_FIELD_LAYOUT, SEEDED_CONSENT_TEMPLATES } = await import(
      './consentSeedData.js'
    )

    const doc = await PDFDocument.create()
    doc.addPage([595.28, 841.89])
    const blank = Buffer.from(await doc.save())

    const gaRow = await pool.query(`SELECT id FROM ga_companies WHERE code = 'YJASSET' LIMIT 1`)
    const seedGaId = gaRow.rows[0]?.id
    if (seedGaId == null) {
      throw new Error('[initDb] consent 시드: YJASSET GA 없음')
    }

    for (const row of SEEDED_CONSENT_TEMPLATES) {
      const exists = await pool.query(
        `SELECT 1 FROM consent_templates WHERE ga_id = $1 AND insurance_company_id = $2 LIMIT 1`,
        [seedGaId, row.insuranceCompanyId],
      )
      if (exists.rows.length > 0) {
        continue
      }
      const key = `consent-templates/${row.id}.pdf`
      await consentPutObject(key, blank, 'application/pdf')
      await pool.query(
        `
        INSERT INTO consent_templates (id, ga_id, insurance_company_id, fax_number, fields, pdf_storage_key)
        VALUES ($1, $2, $3, $4, CAST($5 AS jsonb), $6)
        ON CONFLICT (ga_id, insurance_company_id)
        DO UPDATE SET updated_at = NOW()
        `,
        [row.id, seedGaId, row.insuranceCompanyId, '', JSON.stringify(DEFAULT_CONSENT_FIELD_LAYOUT), key],
      )
    }
    console.log('[initDb] consent_templates 시드 검사 완료')
  } catch (e) {
    console.error('[initDb] consent_templates 시드 실패:', e)
  }
}
