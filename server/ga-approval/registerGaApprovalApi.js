import {
  countPendingRequests,
  GaApprovalError,
  getLatestRequestForApplicant,
  listApprovalRequests,
  processApprovalRequest,
  searchPartnerSignupGas,
} from './gaApprovalService.js'

/**
 * @param {import('express').Router} apiRouter
 * @param {{
 *   pool: import('pg').Pool
 *   requireAuth: import('express').RequestHandler
 *   handleDbError: (e: unknown, req: any, res: any) => void
 *   normalizeUserRole: (r: unknown) => string
 *   parseGaId: (v: unknown) => number | null
 *   attachTenantMembershipSignup: (client: any, p: any) => Promise<void>
 * }} deps
 */
export function registerGaApprovalApi(apiRouter, deps) {
  const { pool, requireAuth, handleDbError, normalizeUserRole, parseGaId, attachTenantMembershipSignup } = deps

  /** 관리자 범위: SUPER_ADMIN → null(전체) / GA_ADMIN → 본인 GA / 그 외 → 403 */
  function resolveAdminScope(req, res) {
    const role = normalizeUserRole(req.user?.role)
    if (role === 'SUPER_ADMIN') {
      const filter = parseGaId(req.query?.ga_id ?? req.query?.gaId)
      return { ok: true, scopeGaId: filter ?? null, role, isSuper: true }
    }
    if (role === 'GA_ADMIN') {
      const gaId = parseGaId(req.user?.gaId ?? req.user?.ga_id)
      if (gaId == null) {
        res.status(403).json({ message: '권한이 없습니다.' })
        return { ok: false }
      }
      return { ok: true, scopeGaId: gaId, role, isSuper: false }
    }
    res.status(403).json({ message: '권한이 없습니다.' })
    return { ok: false }
  }

  // 공개: 가입 가능한 제휴 GA 검색
  apiRouter.get('/auth/partner-gas', async (req, res) => {
    try {
      const items = await searchPartnerSignupGas(pool, String(req.query?.q ?? ''))
      res.json({ items })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  // 신청자 본인 상태
  apiRouter.get('/me/ga-approval', requireAuth, async (req, res) => {
    try {
      const row = await getLatestRequestForApplicant(pool, String(req.user?.id ?? ''))
      res.json({
        request: row
          ? {
              id: row.id,
              status: row.status,
              gaName: row.gaName,
              requestedAt: row.requestedAt,
              processedAt: row.processedAt,
              rejectReason: row.rejectReason,
            }
          : null,
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/ga-approvals', requireAuth, async (req, res) => {
    try {
      const scope = resolveAdminScope(req, res)
      if (!scope.ok) return
      const status = String(req.query?.status ?? 'PENDING').trim().toUpperCase()
      const items = await listApprovalRequests(pool, { scopeGaId: scope.scopeGaId, status })
      const pendingCount = await countPendingRequests(pool, scope.scopeGaId)
      res.json({ items, pendingCount })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  async function handleProcess(req, res, action) {
    try {
      const scope = resolveAdminScope(req, res)
      if (!scope.ok) return
      const requestId = Number(req.params.id)
      if (!Number.isSafeInteger(requestId) || requestId < 1) {
        res.status(400).json({ message: '잘못된 요청입니다.' })
        return
      }
      const result = await processApprovalRequest(pool, {
        requestId,
        action,
        actorUserId: String(req.user?.id ?? ''),
        actorRole: scope.role,
        // SUPER_ADMIN 은 ga_id 쿼리 필터와 무관하게 전체 처리 가능
        actorScopeGaId: scope.isSuper ? null : scope.scopeGaId,
        reason: String(req.body?.reason ?? ''),
        attachMembership: (client, p) =>
          attachTenantMembershipSignup(client, {
            userId: p.userId,
            gaId: p.gaId,
            rbacRole: 'user',
            membershipType: 'agent',
            customerAccess: 'own',
          }),
      })
      res.json(result)
    } catch (e) {
      if (e instanceof GaApprovalError) {
        res.status(e.status).json({ message: e.message, code: e.code })
        return
      }
      handleDbError(e, req, res)
    }
  }

  apiRouter.post('/ga-approvals/:id/approve', requireAuth, (req, res) => handleProcess(req, res, 'APPROVE'))
  apiRouter.post('/ga-approvals/:id/reject', requireAuth, (req, res) => handleProcess(req, res, 'REJECT'))
}
