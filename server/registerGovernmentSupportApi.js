/**
 * government-support CRM API (보험 CRM / 플랫폼 관리와 분리).
 */
import { createGovernmentSupportGuards, isGovernmentIndustryAdmin, isGovernmentSuperAdmin, isGovernmentTenantMember } from './lib/governmentSupport/governmentAccess.js'

/**
 * @param {import('express').Router} router
 * @param {{ pool: import('pg').Pool, requireAuth: Function, handleDbError: Function }} deps
 */
export function registerGovernmentSupportApi(router, deps) {
  const { pool, requireAuth, handleDbError } = deps
  const { requireGovernmentMember, attach } = createGovernmentSupportGuards(pool, {
    requireAuth,
    handleDbError,
  })

  router.get('/government-support/me/access', requireAuth, attach, (req, res) => {
    try {
      const ctx = /** @type {import('express').Request & { platformContext?: import('./lib/platformRbac.js').EffectivePlatformContext }} */ (
        req
      ).platformContext
      if (!ctx) {
        res.status(500).json({ message: 'platformContext missing' })
        return
      }
      res.json({
        success: true,
        data: {
          userId: ctx.userId,
          isSuperAdmin: isGovernmentSuperAdmin(ctx),
          isGovernmentIndustryAdmin: isGovernmentIndustryAdmin(ctx),
          isGovernmentTenantMember: isGovernmentTenantMember(ctx),
          governmentIndustryAdminIndustryIds: [...(ctx.governmentIndustryAdminIndustryIds ?? [])],
          governmentAgencyAdminTenantIds: [...(ctx.governmentAgencyAdminTenantIds ?? [])],
          governmentStaffTenantIds: [...(ctx.governmentStaffTenantIds ?? [])],
        },
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })
}
