import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'
import { canAccessSharedAccountUserList } from '../lib/sharedAccountAccess.js'
import { listUserInsurerAccounts } from '../services/userInsurerAccountService.js'
import {
  createUserInsurerAccountRecord,
  deleteUserInsurerAccountRecord,
  parseUserInsurerAccountId,
  patchUserInsurerAccountRecord,
  respondUserInsurerAccountMutationError,
} from '../services/userInsurerAccountMutationService.js'
import {
  getTargetShareState,
  listSharedAccountUsersForGa,
} from '../services/userInsurerAccountShareVisibilityService.js'
import { resolveOwnerDisplayName } from '../services/userInsurerAccountShareService.js'
import {
  createActiveSharedListLink,
  getActiveSharedListLinkRow,
  getOrCreateActiveSharedListLink,
  regenerateActiveSharedListLink,
  resolveActiveSharedListLinkContext,
  sharedListLinkTokenSuffix,
} from '../services/userInsurerAccountSharedListLinkService.js'
import { SHARED_ACCOUNT_CATEGORY_ACCESS } from '../lib/userInsurerAccountCategoryAccess.js'

function resolveStaffListLinkRequester(req, res) {
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
  const requester = { userId, gaId, role: req.user?.role }
  if (
    !canAccessSharedAccountUserList({
      requesterRole: requester.role,
      requesterGaId: requester.gaId,
    })
  ) {
    res.status(403).json({ message: '공유 계정관리 목록 URL을 생성할 권한이 없습니다.' })
    return null
  }
  return requester
}

/**
 * @param {import('express').Request} req
 * @param {string} token
 */
function buildSharedListPageUrl(req, token) {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https').split(',')[0].trim()
  const host = String(req.headers['x-forwarded-host'] ?? req.get('host') ?? '').split(',')[0].trim()
  const path = `/share/account-credentials/shared/${encodeURIComponent(token)}`
  if (!host) {
    return path
  }
  return `${proto}://${host}${path}`
}

function parseTargetUserId(raw) {
  const id = String(raw ?? '').trim()
  return id || null
}

async function resolveTargetDisplayName(pool, targetUserId) {
  const r = await safeQuery(
    pool,
    `SELECT display_name, name, username FROM users WHERE id = $1 LIMIT 1`,
    [targetUserId],
    { allowUnscoped: true },
  )
  const row = r.rows[0]
  return resolveOwnerDisplayName(row?.display_name, row?.name, row?.username)
}

/**
 * 공개 목록 URL token 으로 대상 USER 계정관리 owner 컨텍스트를 검증한다.
 */
async function resolvePublicSharedListOwnerContext(pool, linkContext, targetUserId, res) {
  const targetState = await getTargetShareState(pool, safeQuery, linkContext.gaId, targetUserId)
  if (!targetState?.isEnabled) {
    res.status(403).json({ message: '공유된 계정관리에 접근할 권한이 없습니다.' })
    return null
  }
  const userR = await safeQuery(
    pool,
    `
    SELECT id, ga_id, role
    FROM users
    WHERE id = $1
      AND COALESCE(is_deleted, false) = false
    LIMIT 1
    `,
    [targetUserId],
    { allowUnscoped: true },
  )
  const userRow = userR.rows[0]
  if (!userRow || userRow.role !== 'USER' || Number(userRow.ga_id) !== linkContext.gaId) {
    res.status(403).json({ message: '공유된 계정관리에 접근할 권한이 없습니다.' })
    return null
  }
  return { userId: targetUserId, gaId: linkContext.gaId }
}

function respondSharedListLinkPayload(req, res, row, token) {
  res.json({
    shareUrl: buildSharedListPageUrl(req, token),
    token,
    createdAt: row?.created_at ?? null,
  })
}

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {Function} ctx.requireAuth
 * @param {Function} ctx.handleDbError
 */
export function registerUserInsurerAccountSharedListLinkApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.get('/user-insurer-accounts/shared-list-link', requireAuth, async (req, res) => {
    try {
      const requester = resolveStaffListLinkRequester(req, res)
      if (!requester) {
        return
      }
      const row = await getActiveSharedListLinkRow(pool, safeQuery, requester.gaId)
      if (!row?.token) {
        res.json({ shareUrl: null, token: null, createdAt: null })
        return
      }
      respondSharedListLinkPayload(req, res, row, String(row.token))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/user-insurer-accounts/shared-list-link', requireAuth, async (req, res) => {
    try {
      const requester = resolveStaffListLinkRequester(req, res)
      if (!requester) {
        return
      }
      const result = await getOrCreateActiveSharedListLink(
        pool,
        safeQuery,
        requester.gaId,
        requester.userId,
      )
      const row = await getActiveSharedListLinkRow(pool, safeQuery, requester.gaId)
      res.status(result.created ? 201 : 200).json({
        shareUrl: buildSharedListPageUrl(req, result.token),
        token: result.token,
        createdAt: row?.created_at ?? result.createdAt ?? null,
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/user-insurer-accounts/shared-list-link/regenerate', requireAuth, async (req, res) => {
    try {
      const requester = resolveStaffListLinkRequester(req, res)
      if (!requester) {
        return
      }
      const { token } = await regenerateActiveSharedListLink(
        pool,
        safeQuery,
        requester.gaId,
        requester.userId,
      )
      const row = await getActiveSharedListLinkRow(pool, safeQuery, requester.gaId)
      console.info('[shared-list-link] regenerated', {
        gaId: requester.gaId,
        createdByUserId: requester.userId,
        tokenSuffix: sharedListLinkTokenSuffix(token),
      })
      respondSharedListLinkPayload(req, res, row, token)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/public/user-insurer-accounts/shared-list/:token/users', async (req, res) => {
    try {
      const linkContext = await resolveActiveSharedListLinkContext(pool, safeQuery, req.params.token)
      if (!linkContext) {
        res.status(410).json({ message: '만료되었거나 유효하지 않은 링크입니다.' })
        return
      }
      const data = await listSharedAccountUsersForGa(pool, safeQuery, linkContext.gaId)
      console.info('[shared-list-link] public users list', {
        gaId: linkContext.gaId,
        linkId: linkContext.linkId,
        tokenSuffix: sharedListLinkTokenSuffix(linkContext.token),
        returnedRowCount: data.length,
      })
      res.json(data)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/public/user-insurer-accounts/shared-list/:token/users/:userId/accounts', async (req, res) => {
    try {
      const linkContext = await resolveActiveSharedListLinkContext(pool, safeQuery, req.params.token)
      if (!linkContext) {
        res.status(410).json({ message: '만료되었거나 유효하지 않은 링크입니다.' })
        return
      }
      const targetUserId = parseTargetUserId(req.params.userId)
      if (!targetUserId) {
        res.status(400).json({ message: '유효하지 않은 사용자입니다.' })
        return
      }
      const owner = await resolvePublicSharedListOwnerContext(pool, linkContext, targetUserId, res)
      if (!owner) {
        return
      }
      const [accounts, ownerDisplayName] = await Promise.all([
        listUserInsurerAccounts(pool, safeQuery, owner.userId, owner.gaId, {
          bootstrapIfEmpty: true,
          ...SHARED_ACCOUNT_CATEGORY_ACCESS,
        }),
        resolveTargetDisplayName(pool, targetUserId),
      ])
      console.info('[shared-list-link] public accounts read', {
        gaId: linkContext.gaId,
        targetUserId,
        tokenSuffix: sharedListLinkTokenSuffix(linkContext.token),
      })
      res.json({ accounts, ownerDisplayName })
    } catch (error) {
      if (error?.message === 'user_insurer_account_secret_storage_unavailable') {
        res.status(503).json({ message: '비밀번호 저장 키가 설정되지 않았습니다.' })
        return
      }
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/public/user-insurer-accounts/shared-list/:token/users/:userId/accounts', async (req, res) => {
    try {
      const linkContext = await resolveActiveSharedListLinkContext(pool, safeQuery, req.params.token)
      if (!linkContext) {
        res.status(410).json({ message: '만료되었거나 유효하지 않은 링크입니다.' })
        return
      }
      const targetUserId = parseTargetUserId(req.params.userId)
      if (!targetUserId) {
        res.status(400).json({ message: '유효하지 않은 사용자입니다.' })
        return
      }
      const owner = await resolvePublicSharedListOwnerContext(pool, linkContext, targetUserId, res)
      if (!owner) {
        return
      }
      const account = await createUserInsurerAccountRecord(
        pool,
        safeQuery,
        owner,
        req.body ?? {},
        SHARED_ACCOUNT_CATEGORY_ACCESS,
      )
      console.info('[shared-list-link] public account create', {
        gaId: linkContext.gaId,
        targetUserId,
        tokenSuffix: sharedListLinkTokenSuffix(linkContext.token),
      })
      res.status(201).json({ account })
    } catch (error) {
      if (respondUserInsurerAccountMutationError(error, res)) {
        return
      }
      handleDbError(error, req, res)
    }
  })

  apiRouter.patch(
    '/public/user-insurer-accounts/shared-list/:token/users/:userId/accounts/:id',
    async (req, res) => {
      try {
        const linkContext = await resolveActiveSharedListLinkContext(pool, safeQuery, req.params.token)
        if (!linkContext) {
          res.status(410).json({ message: '만료되었거나 유효하지 않은 링크입니다.' })
          return
        }
        const targetUserId = parseTargetUserId(req.params.userId)
        if (!targetUserId) {
          res.status(400).json({ message: '유효하지 않은 사용자입니다.' })
          return
        }
        const owner = await resolvePublicSharedListOwnerContext(pool, linkContext, targetUserId, res)
        if (!owner) {
          return
        }
        const accountId = parseUserInsurerAccountId(req.params.id)
        if (accountId == null) {
          res.status(400).json({ message: '유효하지 않은 계정 id입니다.' })
          return
        }
        const account = await patchUserInsurerAccountRecord(
          pool,
          safeQuery,
          owner,
          accountId,
          req.body ?? {},
          SHARED_ACCOUNT_CATEGORY_ACCESS,
        )
        console.info('[shared-list-link] public account patch', {
          gaId: linkContext.gaId,
          targetUserId,
          accountId,
          tokenSuffix: sharedListLinkTokenSuffix(linkContext.token),
        })
        res.json({ account })
      } catch (error) {
        if (respondUserInsurerAccountMutationError(error, res)) {
          return
        }
        handleDbError(error, req, res)
      }
    },
  )

  apiRouter.delete(
    '/public/user-insurer-accounts/shared-list/:token/users/:userId/accounts/:id',
    async (req, res) => {
      try {
        const linkContext = await resolveActiveSharedListLinkContext(pool, safeQuery, req.params.token)
        if (!linkContext) {
          res.status(410).json({ message: '만료되었거나 유효하지 않은 링크입니다.' })
          return
        }
        const targetUserId = parseTargetUserId(req.params.userId)
        if (!targetUserId) {
          res.status(400).json({ message: '유효하지 않은 사용자입니다.' })
          return
        }
        const owner = await resolvePublicSharedListOwnerContext(pool, linkContext, targetUserId, res)
        if (!owner) {
          return
        }
        const accountId = parseUserInsurerAccountId(req.params.id)
        if (accountId == null) {
          res.status(400).json({ message: '유효하지 않은 계정 id입니다.' })
          return
        }
        await deleteUserInsurerAccountRecord(
          pool,
          safeQuery,
          owner,
          accountId,
          SHARED_ACCOUNT_CATEGORY_ACCESS,
        )
        console.info('[shared-list-link] public account delete', {
          gaId: linkContext.gaId,
          targetUserId,
          accountId,
          tokenSuffix: sharedListLinkTokenSuffix(linkContext.token),
        })
        res.json({ ok: true })
      } catch (error) {
        if (respondUserInsurerAccountMutationError(error, res)) {
          return
        }
        handleDbError(error, req, res)
      }
    },
  )
}

export { buildSharedListPageUrl }
