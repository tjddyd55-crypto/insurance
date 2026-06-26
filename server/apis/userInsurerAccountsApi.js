import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'
import {
  bootstrapDefaultUserInsurerAccounts,
  encodeUserInsurerAccountPassword,
  listUserInsurerAccounts,
  mapUserInsurerAccountRow,
  normalizeUserInsurerAccountCategory,
} from '../services/userInsurerAccountService.js'

function resolveOwnerContext(req, res) {
  const userId = req.user?.id ? String(req.user.id) : ''
  if (!userId) {
    res.status(401).json({ message: '로그인이 필요합니다.' })
    return null
  }
  const gaId = parseGaId(req.user?.gaId ?? req.gaId)
  if (gaId == null) {
    res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
    return null
  }
  return { userId, gaId }
}

function parseAccountId(raw) {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

function sanitizePatchBody(body) {
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
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {Function} ctx.requireAuth
 * @param {Function} ctx.handleDbError
 */
export function registerUserInsurerAccountsApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.get('/user-insurer-accounts', requireAuth, async (req, res) => {
    try {
      const owner = resolveOwnerContext(req, res)
      if (!owner) {
        return
      }
      const accounts = await listUserInsurerAccounts(pool, safeQuery, owner.userId, owner.gaId, {
        bootstrapIfEmpty: true,
      })
      res.json({ accounts })
    } catch (error) {
      if (error?.message === 'user_insurer_account_secret_storage_unavailable') {
        res.status(503).json({ message: '비밀번호 저장 키가 설정되지 않았습니다.' })
        return
      }
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/user-insurer-accounts/bootstrap-defaults', requireAuth, async (req, res) => {
    try {
      const owner = resolveOwnerContext(req, res)
      if (!owner) {
        return
      }
      const inserted = await bootstrapDefaultUserInsurerAccounts(
        pool,
        safeQuery,
        owner.userId,
        owner.gaId,
      )
      const accounts = await listUserInsurerAccounts(pool, safeQuery, owner.userId, owner.gaId)
      res.json({ ok: true, inserted, accounts })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/user-insurer-accounts', requireAuth, async (req, res) => {
    try {
      const owner = resolveOwnerContext(req, res)
      if (!owner) {
        return
      }
      const body = req.body ?? {}
      const category = normalizeUserInsurerAccountCategory(body.category)
      const companyName = String(body.companyName ?? body.company_name ?? '').trim()
      if (!category) {
        res.status(400).json({ message: '보험 분류를 선택해 주세요.' })
        return
      }
      if (!companyName) {
        res.status(400).json({ message: '회사명을 입력해 주세요.' })
        return
      }
      const loginId = String(body.loginId ?? body.login_id ?? '').trim()
      const memo = String(body.memo ?? '')
      let loginPasswordEncrypted = null
      if (Object.prototype.hasOwnProperty.call(body, 'loginPassword') || Object.prototype.hasOwnProperty.call(body, 'login_password')) {
        loginPasswordEncrypted = encodeUserInsurerAccountPassword(body.loginPassword ?? body.login_password)
      }

      const sortR = await safeQuery(
        pool,
        `
        SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort
        FROM user_insurer_accounts
        WHERE owner_user_id = $1 AND category = $2 AND is_archived = false
        `,
        [owner.userId, category],
        { allowUnscoped: true },
      )
      const nextSort = Number(sortR.rows[0]?.next_sort ?? 0)

      const r = await safeQuery(
        pool,
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
      res.status(201).json({ account: mapUserInsurerAccountRow(r.rows[0]) })
    } catch (error) {
      if (error?.message === 'user_insurer_account_secret_storage_unavailable') {
        res.status(503).json({ message: '비밀번호 저장 키가 설정되지 않았습니다.' })
        return
      }
      handleDbError(error, req, res)
    }
  })

  apiRouter.patch('/user-insurer-accounts/:id', requireAuth, async (req, res) => {
    try {
      const owner = resolveOwnerContext(req, res)
      if (!owner) {
        return
      }
      const accountId = parseAccountId(req.params.id)
      if (accountId == null) {
        res.status(400).json({ message: '유효하지 않은 계정 id입니다.' })
        return
      }
      const existing = await safeQuery(
        pool,
        `
        SELECT id, is_custom
        FROM user_insurer_accounts
        WHERE id = $1 AND owner_user_id = $2 AND is_archived = false
        LIMIT 1
        `,
        [accountId, owner.userId],
        { allowUnscoped: true },
      )
      if ((existing.rowCount ?? 0) === 0) {
        res.status(404).json({ message: '계정 정보를 찾을 수 없습니다.' })
        return
      }
      const patch = sanitizePatchBody(req.body)
      const sets = []
      const params = [accountId, owner.userId]

      if (Object.prototype.hasOwnProperty.call(patch, 'companyName')) {
        if (!existing.rows[0]?.is_custom) {
          res.status(400).json({ message: '기본 보험회사명은 변경할 수 없습니다.' })
          return
        }
        if (!patch.companyName) {
          res.status(400).json({ message: '회사명을 입력해 주세요.' })
          return
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
        res.status(400).json({ message: '변경할 항목이 없습니다.' })
        return
      }
      sets.push('updated_at = NOW()')
      const r = await safeQuery(
        pool,
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
        res.status(404).json({ message: '계정 정보를 찾을 수 없습니다.' })
        return
      }
      res.json({ account: mapUserInsurerAccountRow(r.rows[0]) })
    } catch (error) {
      if (error?.message === 'user_insurer_account_secret_storage_unavailable') {
        res.status(503).json({ message: '비밀번호 저장 키가 설정되지 않았습니다.' })
        return
      }
      handleDbError(error, req, res)
    }
  })

  apiRouter.delete('/user-insurer-accounts/:id', requireAuth, async (req, res) => {
    try {
      const owner = resolveOwnerContext(req, res)
      if (!owner) {
        return
      }
      const accountId = parseAccountId(req.params.id)
      if (accountId == null) {
        res.status(400).json({ message: '유효하지 않은 계정 id입니다.' })
        return
      }
      const r = await safeQuery(
        pool,
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
        res.status(404).json({ message: '계정 정보를 찾을 수 없습니다.' })
        return
      }
      res.json({ ok: true })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })
}
