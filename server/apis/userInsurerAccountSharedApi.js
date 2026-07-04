import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'
import { canAccessSharedAccountManagement, canAccessSharedAccountUserList } from '../lib/sharedAccountAccess.js'
import { listUserInsurerAccounts } from '../services/userInsurerAccountService.js'
import {
  createUserInsurerAccountRecord,
  deleteUserInsurerAccountRecord,
  parseUserInsurerAccountId,
  patchUserInsurerAccountRecord,
  respondUserInsurerAccountMutationError,
} from '../services/userInsurerAccountMutationService.js'
import {
  getShareVisibility,
  getTargetShareState,
  listSharedAccountUsers,
  setShareVisibility,
} from '../services/userInsurerAccountShareVisibilityService.js'
import { resolveOwnerDisplayName } from '../services/userInsurerAccountShareService.js'
import {
  logShareVisibilityPatchValidationFailure,
  parseShareVisibilityEnabledFromBody,
  shareVisibilitySuccessPayload,
} from '../lib/userInsurerAccountShareVisibilityApi.js'

/**
 * 요청자(로그인 사용자) 컨텍스트. gaId 없으면 400.
 */
function resolveRequesterContext(req, res) {
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
  return { userId, gaId, role: req.user?.role }
}

function parseTargetUserId(raw) {
  const id = String(raw ?? '').trim()
  return id || null
}

/**
 * 스태프가 대상 사용자의 공유 계정관리에 접근 가능한지 검증하고,
 * 계정 서비스 재사용을 위한 owner 컨텍스트({ userId, gaId })를 돌려준다.
 * 접근 불가 시 응답을 채우고 null 을 반환한다(서버 강제 검증).
 */
async function resolveSharedOwnerContext(pool, requester, targetUserId, res) {
  const targetState = await getTargetShareState(pool, safeQuery, requester.gaId, targetUserId)
  const allowed = canAccessSharedAccountManagement({
    requesterRole: requester.role,
    requesterGaId: requester.gaId,
    targetGaId: targetState?.gaId,
    targetShareEnabled: targetState?.isEnabled,
  })
  if (!allowed) {
    res.status(403).json({ message: '공유된 계정관리에 접근할 권한이 없습니다.' })
    return null
  }
  return { userId: targetUserId, gaId: requester.gaId }
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
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {Function} ctx.requireAuth
 * @param {Function} ctx.handleDbError
 */
export function registerUserInsurerAccountSharedApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  // 내 공유 상태 조회
  apiRouter.get('/user-insurer-accounts/share-visibility', requireAuth, async (req, res) => {
    try {
      const requester = resolveRequesterContext(req, res)
      if (!requester) {
        return
      }
      const enabled = await getShareVisibility(pool, safeQuery, requester.userId, requester.gaId)
      res.json(shareVisibilitySuccessPayload(enabled))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  // 내 공유 상태 변경
  apiRouter.patch('/user-insurer-accounts/share-visibility', requireAuth, async (req, res) => {
    try {
      const requester = resolveRequesterContext(req, res)
      if (!requester) {
        return
      }
      const nextEnabled = parseShareVisibilityEnabledFromBody(req.body)
      if (nextEnabled == null) {
        logShareVisibilityPatchValidationFailure(req, 'enabled_boolean_required', {
          userId: requester.userId,
          gaId: requester.gaId,
        })
        res.status(400).json({ message: 'enabled 값(true/false)이 필요합니다.' })
        return
      }
      const enabled = await setShareVisibility(pool, safeQuery, requester.userId, requester.gaId, nextEnabled)
      res.json(shareVisibilitySuccessPayload(enabled))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  // 스태프용 공유 사용자 목록 (이름만)
  apiRouter.get('/user-insurer-accounts/shared-users', requireAuth, async (req, res) => {
    try {
      const requester = resolveRequesterContext(req, res)
      if (!requester) {
        return
      }
      if (
        !canAccessSharedAccountUserList({
          requesterRole: requester.role,
          requesterGaId: requester.gaId,
        })
      ) {
        res.status(403).json({ message: '공유 계정관리 목록에 접근할 권한이 없습니다.' })
        return
      }
      const data = await listSharedAccountUsers(pool, safeQuery, requester.gaId, requester.userId)
      console.info('[shared-users] list', {
        requesterRole: requester.role,
        requesterGaId: requester.gaId,
        returnedRowCount: data.length,
      })
      res.json({ success: true, data })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  // 스태프용 대상 사용자 계정관리 조회
  apiRouter.get('/user-insurer-accounts/shared-users/:userId/accounts', requireAuth, async (req, res) => {
    try {
      const requester = resolveRequesterContext(req, res)
      if (!requester) {
        return
      }
      const targetUserId = parseTargetUserId(req.params.userId)
      if (!targetUserId) {
        res.status(400).json({ message: '유효하지 않은 사용자입니다.' })
        return
      }
      const owner = await resolveSharedOwnerContext(pool, requester, targetUserId, res)
      if (!owner) {
        return
      }
      const [accounts, ownerDisplayName] = await Promise.all([
        listUserInsurerAccounts(pool, safeQuery, owner.userId, owner.gaId, { bootstrapIfEmpty: true }),
        resolveTargetDisplayName(pool, targetUserId),
      ])
      res.json({ accounts, ownerDisplayName })
    } catch (error) {
      if (error?.message === 'user_insurer_account_secret_storage_unavailable') {
        res.status(503).json({ message: '비밀번호 저장 키가 설정되지 않았습니다.' })
        return
      }
      handleDbError(error, req, res)
    }
  })

  // 스태프용 대상 사용자 계정 추가
  apiRouter.post('/user-insurer-accounts/shared-users/:userId/accounts', requireAuth, async (req, res) => {
    try {
      const requester = resolveRequesterContext(req, res)
      if (!requester) {
        return
      }
      const targetUserId = parseTargetUserId(req.params.userId)
      if (!targetUserId) {
        res.status(400).json({ message: '유효하지 않은 사용자입니다.' })
        return
      }
      const owner = await resolveSharedOwnerContext(pool, requester, targetUserId, res)
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

  // 스태프용 대상 사용자 계정 수정
  apiRouter.patch('/user-insurer-accounts/shared-users/:userId/accounts/:id', requireAuth, async (req, res) => {
    try {
      const requester = resolveRequesterContext(req, res)
      if (!requester) {
        return
      }
      const targetUserId = parseTargetUserId(req.params.userId)
      if (!targetUserId) {
        res.status(400).json({ message: '유효하지 않은 사용자입니다.' })
        return
      }
      const owner = await resolveSharedOwnerContext(pool, requester, targetUserId, res)
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

  // 스태프용 대상 사용자 계정 삭제
  apiRouter.delete('/user-insurer-accounts/shared-users/:userId/accounts/:id', requireAuth, async (req, res) => {
    try {
      const requester = resolveRequesterContext(req, res)
      if (!requester) {
        return
      }
      const targetUserId = parseTargetUserId(req.params.userId)
      if (!targetUserId) {
        res.status(400).json({ message: '유효하지 않은 사용자입니다.' })
        return
      }
      const owner = await resolveSharedOwnerContext(pool, requester, targetUserId, res)
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
