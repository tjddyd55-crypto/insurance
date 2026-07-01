import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'
import {
  bootstrapDefaultUserInsurerAccounts,
  listUserInsurerAccounts,
} from '../services/userInsurerAccountService.js'
import {
  createUserInsurerAccountRecord,
  deleteUserInsurerAccountRecord,
  parseUserInsurerAccountId,
  patchUserInsurerAccountRecord,
  respondUserInsurerAccountMutationError,
} from '../services/userInsurerAccountMutationService.js'

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
      const account = await createUserInsurerAccountRecord(pool, safeQuery, owner, req.body ?? {})
      res.status(201).json({ account })
    } catch (error) {
      if (respondUserInsurerAccountMutationError(error, res)) {
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
      const accountId = parseUserInsurerAccountId(req.params.id)
      if (accountId == null) {
        res.status(400).json({ message: '유효하지 않은 계정 id입니다.' })
        return
      }
      const account = await patchUserInsurerAccountRecord(pool, safeQuery, owner, accountId, req.body ?? {})
      res.json({ account })
    } catch (error) {
      if (respondUserInsurerAccountMutationError(error, res)) {
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
      const accountId = parseUserInsurerAccountId(req.params.id)
      if (accountId == null) {
        res.status(400).json({ message: '유효하지 않은 계정 id입니다.' })
        return
      }
      await deleteUserInsurerAccountRecord(pool, safeQuery, owner, accountId)
      res.json({ ok: true })
    } catch (error) {
      if (respondUserInsurerAccountMutationError(error, res)) {
        return
      }
      handleDbError(error, req, res)
    }
  })
}
