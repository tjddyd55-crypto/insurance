import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'
import {
  createUserInsurerAccountRecord,
  deleteUserInsurerAccountRecord,
  parseUserInsurerAccountId,
  patchUserInsurerAccountRecord,
  respondUserInsurerAccountMutationError,
} from '../services/userInsurerAccountMutationService.js'
import { listUserInsurerAccounts } from '../services/userInsurerAccountService.js'
import {
  createActiveShareToken,
  getActiveShareTokenRow,
  normalizeShareToken,
  resolveActiveShareTokenContext,
  resolveOwnerDisplayName,
} from '../services/userInsurerAccountShareService.js'

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
 * @param {import('express').Request} req
 */
function buildSharePageUrl(req, token) {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https').split(',')[0].trim()
  const host = String(req.headers['x-forwarded-host'] ?? req.get('host') ?? '').split(',')[0].trim()
  if (!host) {
    return `/share/account-credentials/${encodeURIComponent(token)}`
  }
  return `${proto}://${host}/share/account-credentials/${encodeURIComponent(token)}`
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} token
 */
async function resolveShareOwner(pool, token, res) {
  const owner = await resolveActiveShareTokenContext(pool, safeQuery, token)
  if (!owner) {
    res.status(410).json({ message: '만료되었거나 유효하지 않은 링크입니다.' })
    return null
  }
  return owner
}

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {Function} ctx.requireAuth
 * @param {Function} ctx.handleDbError
 */
export function registerUserInsurerAccountShareApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.get('/user-insurer-accounts/share-link', requireAuth, async (req, res) => {
    try {
      const owner = resolveOwnerContext(req, res)
      if (!owner) {
        return
      }
      const row = await getActiveShareTokenRow(pool, safeQuery, owner.userId, owner.gaId)
      if (!row?.token) {
        res.json({ shareUrl: null, token: null, ownerDisplayName: null })
        return
      }
      const userR = await safeQuery(
        pool,
        `SELECT display_name, name, username FROM users WHERE id = $1 LIMIT 1`,
        [owner.userId],
        { allowUnscoped: true },
      )
      const userRow = userR.rows[0]
      const ownerDisplayName = resolveOwnerDisplayName(
        userRow?.display_name,
        userRow?.name,
        userRow?.username,
      )
      res.json({
        shareUrl: buildSharePageUrl(req, row.token),
        token: row.token,
        ownerDisplayName,
        createdAt: row.created_at,
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/user-insurer-accounts/share-link', requireAuth, async (req, res) => {
    try {
      const owner = resolveOwnerContext(req, res)
      if (!owner) {
        return
      }
      const token = await createActiveShareToken(pool, safeQuery, owner.userId, owner.gaId)
      const userR = await safeQuery(
        pool,
        `SELECT display_name, name, username FROM users WHERE id = $1 LIMIT 1`,
        [owner.userId],
        { allowUnscoped: true },
      )
      const userRow = userR.rows[0]
      const ownerDisplayName = resolveOwnerDisplayName(
        userRow?.display_name,
        userRow?.name,
        userRow?.username,
      )
      res.status(201).json({
        shareUrl: buildSharePageUrl(req, token),
        token,
        ownerDisplayName,
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/public/user-insurer-accounts/:token', async (req, res) => {
    try {
      const token = normalizeShareToken(req.params.token)
      const owner = await resolveShareOwner(pool, token, res)
      if (!owner) {
        return
      }
      res.json({
        ok: true,
        ownerDisplayName: owner.ownerDisplayName,
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/public/user-insurer-accounts/:token/accounts', async (req, res) => {
    try {
      const token = normalizeShareToken(req.params.token)
      const owner = await resolveShareOwner(pool, token, res)
      if (!owner) {
        return
      }
      const accounts = await listUserInsurerAccounts(pool, safeQuery, owner.userId, owner.gaId, {
        bootstrapIfEmpty: true,
      })
      res.json({ accounts, ownerDisplayName: owner.ownerDisplayName })
    } catch (error) {
      if (error?.message === 'user_insurer_account_secret_storage_unavailable') {
        res.status(503).json({ message: '비밀번호 저장 키가 설정되지 않았습니다.' })
        return
      }
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/public/user-insurer-accounts/:token/accounts', async (req, res) => {
    try {
      const token = normalizeShareToken(req.params.token)
      const owner = await resolveShareOwner(pool, token, res)
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

  apiRouter.patch('/public/user-insurer-accounts/:token/accounts/:id', async (req, res) => {
    try {
      const token = normalizeShareToken(req.params.token)
      const owner = await resolveShareOwner(pool, token, res)
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

  apiRouter.delete('/public/user-insurer-accounts/:token/accounts/:id', async (req, res) => {
    try {
      const token = normalizeShareToken(req.params.token)
      const owner = await resolveShareOwner(pool, token, res)
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
