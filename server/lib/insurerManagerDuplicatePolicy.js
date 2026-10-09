/** @typedef {import('pg').Pool} PgPool */

export const INSURER_MANAGER_USERNAME_CONFLICT_MESSAGE = '이미 사용 중인 아이디입니다.'
export const INSURER_MANAGER_COMPANY_CONFLICT_MESSAGE =
  '해당 보험사에 이미 등록된 담당자 계정이 있습니다.'

/**
 * insurer_managers 중복 정책 SSOT:
 * - username: 플랫폼 전역 (부분 인덱스 is_deleted = false)
 * - 보험사 계정: ga_id + company_id (부분 인덱스)
 *
 * 레거시 전역 company_id / insurer_name 유니크는 제거한다.
 *
 * @param {PgPool} pool
 */
export async function ensureInsurerManagerDuplicateIndexes(pool) {
  await pool.query(`DROP INDEX IF EXISTS uq_insurer_managers_ga_insurer_active`)

  const constraintRows = await pool.query(`
    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'insurer_managers'
      AND c.contype = 'u'
  `)
  for (const row of constraintRows.rows) {
    const name = String(row.conname ?? '')
    const def = String(row.def ?? '')
    if (!name || !def) {
      continue
    }
    const mentionsGa = def.includes('ga_id')
    if (def.includes('username') && !mentionsGa) {
      const safe = name.replace(/"/g, '""')
      await pool.query(`ALTER TABLE insurer_managers DROP CONSTRAINT IF EXISTS "${safe}"`)
      continue
    }
    if ((def.includes('company_id') || def.includes('insurer_name')) && !mentionsGa) {
      const safe = name.replace(/"/g, '""')
      await pool.query(`ALTER TABLE insurer_managers DROP CONSTRAINT IF EXISTS "${safe}"`)
    }
  }

  const { rows } = await pool.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'insurer_managers'
      AND indexdef ILIKE '%UNIQUE%'
  `)

  for (const row of rows) {
    const name = String(row.indexname ?? '')
    const def = String(row.indexdef ?? '')
    if (!name || !def) {
      continue
    }
    const isPartialActiveOnly = def.includes('is_deleted')
    if (def.includes('username')) {
      if (!isPartialActiveOnly) {
        const safeIndexName = name.replace(/"/g, '""')
        await pool.query(`DROP INDEX IF EXISTS "${safeIndexName}"`)
      }
      continue
    }
    const mentionsCompany = def.includes('company_id')
    const mentionsInsurerName = def.includes('insurer_name')
    const mentionsGa = def.includes('ga_id')
    if ((mentionsCompany || mentionsInsurerName) && !mentionsGa) {
      const safeIndexName = name.replace(/"/g, '""')
      await pool.query(`DROP INDEX IF EXISTS "${safeIndexName}"`)
    }
  }

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_insurer_managers_username_active
    ON insurer_managers (username)
    WHERE is_deleted = false
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_insurer_managers_ga_company_active
    ON insurer_managers (ga_id, company_id)
    WHERE is_deleted = false AND company_id IS NOT NULL
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_insurer_manager_unique
    ON insurer_managers (ga_id, company_id, username)
    WHERE is_deleted = false
  `)
}

/**
 * @param {unknown} error
 * @returns {string | null}
 */
export function resolveInsurerManagerUniqueConflictMessage(error) {
  if (!error || typeof error !== 'object' || error.code !== '23505') {
    return null
  }
  const constraint = String(error.constraint ?? '').toLowerCase()
  const detail = String(error.detail ?? '').toLowerCase()

  if (constraint.includes('username') || detail.includes('(username)=')) {
    return INSURER_MANAGER_USERNAME_CONFLICT_MESSAGE
  }
  if (
    constraint.includes('ga_company') ||
    constraint.includes('company_id') ||
    constraint.includes('insurer_name') ||
    detail.includes('(company_id)=') ||
    detail.includes('(insurer_name)=') ||
    detail.includes('(ga_id, company_id)') ||
    detail.includes('(ga_id, insurer_name)')
  ) {
    return INSURER_MANAGER_COMPANY_CONFLICT_MESSAGE
  }
  if (constraint.includes('insurer_manager') && !constraint.includes('username')) {
    return INSURER_MANAGER_COMPANY_CONFLICT_MESSAGE
  }
  return INSURER_MANAGER_USERNAME_CONFLICT_MESSAGE
}
