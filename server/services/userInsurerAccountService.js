import { safeQuery } from '../utils/dbSafeQuery.js'
import {
  canStoreUserInsurerAccountSecrets,
  decryptUserInsurerAccountPassword,
  encryptUserInsurerAccountPassword,
} from '../lib/userInsurerAccountCrypto.js'

export const USER_INSURER_ACCOUNT_CATEGORIES = Object.freeze({
  LIFE: 'LIFE',
  NON_LIFE: 'NON_LIFE',
})

/**
 * @param {string | null | undefined} raw
 * @returns {'LIFE' | 'NON_LIFE' | null}
 */
export function normalizeUserInsurerAccountCategory(raw) {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_')
  if (s === 'LIFE' || s === 'NONLIFE' || s === 'NON_LIFE') {
    return s === 'LIFE' ? 'LIFE' : 'NON_LIFE'
  }
  const ko = String(raw ?? '').replace(/\s+/g, '')
  if (/^(생명|생명보험|생보)$/.test(ko)) {
    return 'LIFE'
  }
  if (/^(손해|손해보험|손보)$/.test(ko)) {
    return 'NON_LIFE'
  }
  return null
}

/**
 * @param {import('pg').QueryResultRow} row
 */
export function mapUserInsurerAccountRow(row) {
  const encrypted = row.login_password_encrypted ?? null
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id ?? ''),
    gaId: row.ga_id != null ? Number(row.ga_id) : null,
    category: String(row.category ?? ''),
    companyName: String(row.company_name ?? ''),
    loginId: row.login_id != null ? String(row.login_id) : '',
    loginPassword: decryptUserInsurerAccountPassword(encrypted),
    memo: row.memo != null ? String(row.memo) : '',
    sortOrder: Number(row.sort_order ?? 0),
    isCustom: Boolean(row.is_custom),
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {typeof safeQuery} safeQueryExec
 * @param {string} userId
 */
export async function countActiveUserInsurerAccounts(db, safeQueryExec, userId) {
  const r = await safeQueryExec(
    db,
    `
    SELECT COUNT(*)::int AS c
    FROM user_insurer_accounts
    WHERE owner_user_id = $1 AND is_archived = false
    `,
    [userId],
    { allowUnscoped: true },
  )
  return Number(r.rows[0]?.c ?? 0)
}

/**
 * @param {string} name
 * @param {string | null | undefined} rawCategory
 * @returns {'LIFE' | 'NON_LIFE' | null}
 */
function resolveBootstrapCategory(name, rawCategory) {
  const normalized = normalizeUserInsurerAccountCategory(rawCategory)
  if (normalized === 'LIFE' || normalized === 'NON_LIFE') {
    return normalized
  }
  const compact = String(name ?? '').replace(/\s+/g, '')
  if (!compact) {
    return null
  }
  if (/(생명|생보|라이프)/.test(compact)) {
    return 'LIFE'
  }
  if (/(화재|해상|손보|손해|손해보험)/.test(compact) || (compact.startsWith('메리츠') && compact.includes('화재'))) {
    return 'NON_LIFE'
  }
  return null
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {typeof safeQuery} safeQueryExec
 * @param {number} gaId
 * @returns {Promise<Array<{ name: string, category: 'LIFE' | 'NON_LIFE' }>>}
 */
export async function loadDefaultInsurerCompaniesForGa(db, safeQueryExec, gaId) {
  const r = await safeQueryExec(
    db,
    `
    SELECT name, category
    FROM insurance_company_master
    WHERE ga_id = $1
    ORDER BY category ASC, name ASC, id ASC
    `,
    [gaId],
  )
  const out = []
  const seen = new Set()
  for (const row of r.rows) {
    const name = String(row.name ?? '').trim()
    if (!name) {
      continue
    }
    const category = resolveBootstrapCategory(name, row.category)
    if (category !== 'LIFE' && category !== 'NON_LIFE') {
      continue
    }
    const key = `${category}::${name}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push({ name, category })
  }
  return out
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {typeof safeQuery} safeQueryExec
 * @param {string} userId
 * @param {number} gaId
 */
export async function bootstrapDefaultUserInsurerAccounts(db, safeQueryExec, userId, gaId) {
  const companies = await loadDefaultInsurerCompaniesForGa(db, safeQueryExec, gaId)
  let inserted = 0
  for (let i = 0; i < companies.length; i += 1) {
    const company = companies[i]
    const exists = await safeQueryExec(
      db,
      `
      SELECT 1
      FROM user_insurer_accounts
      WHERE owner_user_id = $1
        AND category = $2
        AND company_name = $3
        AND is_custom = false
        AND is_archived = false
      LIMIT 1
      `,
      [userId, company.category, company.name],
      { allowUnscoped: true },
    )
    if ((exists.rowCount ?? 0) > 0) {
      continue
    }
    await safeQueryExec(
      db,
      `
      INSERT INTO user_insurer_accounts (
        owner_user_id, ga_id, category, company_name,
        login_id, login_password_encrypted, memo,
        sort_order, is_custom, is_archived
      )
      VALUES ($1, $2, $3, $4, NULL, NULL, '', $5, false, false)
      `,
      [userId, gaId, company.category, company.name, i],
      { allowUnscoped: true },
    )
    inserted += 1
  }
  return inserted
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {typeof safeQuery} safeQueryExec
 * @param {string} userId
 * @param {number} gaId
 * @param {{ bootstrapIfEmpty?: boolean }} [options]
 */
export async function listUserInsurerAccounts(db, safeQueryExec, userId, gaId, options = {}) {
  if (options.bootstrapIfEmpty) {
    const count = await countActiveUserInsurerAccounts(db, safeQueryExec, userId)
    if (count === 0) {
      await bootstrapDefaultUserInsurerAccounts(db, safeQueryExec, userId, gaId)
    }
  }
  const r = await safeQueryExec(
    db,
    `
    SELECT
      id, owner_user_id, ga_id, category, company_name,
      login_id, login_password_encrypted, memo,
      sort_order, is_custom, is_archived, created_at, updated_at
    FROM user_insurer_accounts
    WHERE owner_user_id = $1 AND is_archived = false
    ORDER BY
      CASE category WHEN 'LIFE' THEN 0 WHEN 'NON_LIFE' THEN 1 ELSE 2 END,
      sort_order ASC,
      company_name ASC,
      id ASC
    `,
    [userId],
    { allowUnscoped: true },
  )
  return r.rows.map(mapUserInsurerAccountRow)
}

/**
 * @param {string | null | undefined} plainPassword
 * @returns {string | null}
 */
export function encodeUserInsurerAccountPassword(plainPassword) {
  const plain = String(plainPassword ?? '')
  if (!plain) {
    return null
  }
  if (!canStoreUserInsurerAccountSecrets()) {
    throw new Error('user_insurer_account_secret_storage_unavailable')
  }
  return encryptUserInsurerAccountPassword(plain)
}
