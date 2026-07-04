import { safeQuery } from '../utils/dbSafeQuery.js'
import {
  encodeUserInsurerAccountPassword,
  mapUserInsurerAccountRow,
  normalizeUserInsurerAccountCategory,
} from './userInsurerAccountService.js'
import {
  assertAllowedAccountCategory,
  sharedAccountCategoryNotAllowedMessage,
} from '../lib/userInsurerAccountCategoryAccess.js'

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
export function parseUserInsurerAccountId(raw) {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

/**
 * @param {unknown} body
 */
export function sanitizeUserInsurerAccountPatchBody(body) {
  const out = {}
  if (Object.prototype.hasOwnProperty.call(body ?? {}, 'companyName')) {
    out.companyName = String(body.companyName ?? '').trim()
  }
  if (Object.prototype.hasOwnProperty.call(body ?? {}, 'loginId')) {
    out.loginId = String(body.loginId ?? '').trim()
  }
  if (Object.prototype.hasOwnProperty.call(body ?? {}, 'loginPassword')) {
    out.loginPassword = String(body.loginPassword ?? '')
  }
  if (Object.prototype.hasOwnProperty.call(body ?? {}, 'memo')) {
    out.memo = String(body.memo ?? '')
  }
  return out
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {typeof safeQuery} safeQueryExec
 * @param {{ userId: string, gaId: number }} owner
 * @param {unknown} body
 * @param {{ allowedCategories?: readonly string[] }} [options]
 */
export async function createUserInsurerAccountRecord(db, safeQueryExec, owner, body, options = {}) {
  const category = normalizeUserInsurerAccountCategory(body?.category)
  const companyName = String(body?.companyName ?? body?.company_name ?? '').trim()
  if (!category) {
    const error = new Error('invalid_category')
    error.code = 'invalid_category'
    throw error
  }
  assertAllowedAccountCategory(category, options.allowedCategories, 'create')
  if (!companyName) {
    const error = new Error('missing_company_name')
    error.code = 'missing_company_name'
    throw error
  }
  const loginId = String(body?.loginId ?? body?.login_id ?? '').trim()
  const memo = String(body?.memo ?? '')
  let loginPasswordEncrypted = null
  if (
    Object.prototype.hasOwnProperty.call(body ?? {}, 'loginPassword') ||
    Object.prototype.hasOwnProperty.call(body ?? {}, 'login_password')
  ) {
    loginPasswordEncrypted = encodeUserInsurerAccountPassword(body?.loginPassword ?? body?.login_password)
  }

  const sortR = await safeQueryExec(
    db,
    `
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort
    FROM user_insurer_accounts
    WHERE owner_user_id = $1 AND category = $2 AND is_archived = false
    `,
    [owner.userId, category],
    { allowUnscoped: true },
  )
  const nextSort = Number(sortR.rows[0]?.next_sort ?? 0)

  const r = await safeQueryExec(
    db,
    `
    INSERT INTO user_insurer_accounts (
      owner_user_id, ga_id, category, company_name,
      login_id, login_password_encrypted, memo,
      sort_order, is_custom, is_archived
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, false)
    RETURNING
      id, owner_user_id, ga_id, category, company_name,
      login_id, login_password_encrypted, memo,
      sort_order, is_custom, is_archived, created_at, updated_at
    `,
    [owner.userId, owner.gaId, category, companyName, loginId || null, loginPasswordEncrypted, memo, nextSort],
    { allowUnscoped: true },
  )
  return mapUserInsurerAccountRow(r.rows[0])
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {typeof safeQuery} safeQueryExec
 * @param {{ userId: string, gaId: number }} owner
 * @param {number} accountId
 * @param {unknown} body
 * @param {{ allowedCategories?: readonly string[] }} [options]
 */
export async function patchUserInsurerAccountRecord(db, safeQueryExec, owner, accountId, body, options = {}) {
  const existing = await safeQueryExec(
    db,
    `
    SELECT id, is_custom, category
    FROM user_insurer_accounts
    WHERE id = $1 AND owner_user_id = $2 AND is_archived = false
    LIMIT 1
    `,
    [accountId, owner.userId],
    { allowUnscoped: true },
  )
  if ((existing.rowCount ?? 0) === 0) {
    const error = new Error('not_found')
    error.code = 'not_found'
    throw error
  }
  assertAllowedAccountCategory(existing.rows[0]?.category, options.allowedCategories, 'patch')
  if (Object.prototype.hasOwnProperty.call(body ?? {}, 'category')) {
    const nextCategory = normalizeUserInsurerAccountCategory(body?.category)
    assertAllowedAccountCategory(nextCategory, options.allowedCategories, 'patch')
  }
  const patch = sanitizeUserInsurerAccountPatchBody(body)
  const sets = []
  const params = [accountId, owner.userId]

  if (Object.prototype.hasOwnProperty.call(patch, 'companyName')) {
    if (!existing.rows[0]?.is_custom) {
      const error = new Error('default_company_name_locked')
      error.code = 'default_company_name_locked'
      throw error
    }
    if (!patch.companyName) {
      const error = new Error('missing_company_name')
      error.code = 'missing_company_name'
      throw error
    }
    params.push(patch.companyName)
    sets.push(`company_name = $${params.length}`)
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'loginId')) {
    params.push(patch.loginId || null)
    sets.push(`login_id = $${params.length}`)
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'memo')) {
    params.push(patch.memo)
    sets.push(`memo = $${params.length}`)
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'loginPassword')) {
    params.push(encodeUserInsurerAccountPassword(patch.loginPassword))
    sets.push(`login_password_encrypted = $${params.length}`)
  }
  if (sets.length === 0) {
    const error = new Error('empty_patch')
    error.code = 'empty_patch'
    throw error
  }
  sets.push('updated_at = NOW()')
  const r = await safeQueryExec(
    db,
    `
    UPDATE user_insurer_accounts
    SET ${sets.join(', ')}
    WHERE id = $1 AND owner_user_id = $2 AND is_archived = false
    RETURNING
      id, owner_user_id, ga_id, category, company_name,
      login_id, login_password_encrypted, memo,
      sort_order, is_custom, is_archived, created_at, updated_at
    `,
    params,
    { allowUnscoped: true },
  )
  if ((r.rowCount ?? 0) === 0) {
    const error = new Error('not_found')
    error.code = 'not_found'
    throw error
  }
  return mapUserInsurerAccountRow(r.rows[0])
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {typeof safeQuery} safeQueryExec
 * @param {{ userId: string }} owner
 * @param {number} accountId
 * @param {{ allowedCategories?: readonly string[] }} [options]
 */
export async function deleteUserInsurerAccountRecord(db, safeQueryExec, owner, accountId, options = {}) {
  const existing = await safeQueryExec(
    db,
    `
    SELECT id, category
    FROM user_insurer_accounts
    WHERE id = $1 AND owner_user_id = $2 AND is_archived = false
    LIMIT 1
    `,
    [accountId, owner.userId],
    { allowUnscoped: true },
  )
  if ((existing.rowCount ?? 0) === 0) {
    const error = new Error('not_found')
    error.code = 'not_found'
    throw error
  }
  assertAllowedAccountCategory(existing.rows[0]?.category, options.allowedCategories, 'delete')

  const r = await safeQueryExec(
    db,
    `
    UPDATE user_insurer_accounts
    SET is_archived = true, updated_at = NOW()
    WHERE id = $1 AND owner_user_id = $2 AND is_archived = false
    RETURNING id
    `,
    [accountId, owner.userId],
    { allowUnscoped: true },
  )
  if ((r.rowCount ?? 0) === 0) {
    const error = new Error('not_found')
    error.code = 'not_found'
    throw error
  }
}

/**
 * @param {Error & { code?: string }} error
 * @param {import('express').Response} res
 * @returns {boolean}
 */
export function respondUserInsurerAccountMutationError(error, res) {
  if (error?.message === 'user_insurer_account_secret_storage_unavailable') {
    res.status(503).json({ message: '비밀번호 저장 키가 설정되지 않았습니다.' })
    return true
  }
  switch (error?.code) {
    case 'invalid_category':
      res.status(400).json({ message: '보험 분류를 선택해 주세요.' })
      return true
    case 'missing_company_name':
      res.status(400).json({ message: '회사명을 입력해 주세요.' })
      return true
    case 'default_company_name_locked':
      res.status(400).json({ message: '기본 보험회사명은 변경할 수 없습니다.' })
      return true
    case 'empty_patch':
      res.status(400).json({ message: '변경할 항목이 없습니다.' })
      return true
    case 'not_found':
      res.status(404).json({ message: '계정 정보를 찾을 수 없습니다.' })
      return true
    case 'shared_account_category_not_allowed':
      res.status(403).json({ message: sharedAccountCategoryNotAllowedMessage(error) })
      return true
    default:
      return false
  }
}
