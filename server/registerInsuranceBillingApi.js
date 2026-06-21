import {
  getInsuranceBillingProvider,
  isInsuranceBillingEnabled,
  isMockPaymentAllowed,
} from './insurance-billing/config.js'
import {
  enforceInsuranceBillingEntitlement,
  getInsuranceBillingSubscription,
} from './insurance-billing/entitlement.js'
import {
  getCheckoutSummary,
  loadPromotionCodeRow,
  validateInsurancePromotionCode,
} from './insurance-billing/promotionService.js'
import { PROMOTION_ALREADY_USED_ERROR_CODE } from './insurance-billing/billingPromotionRedemptionPolicy.js'
import {
  applyFreeMonthsPromotion,
  getBillingReferralForUser,
  requestInsurancePayment,
} from './insurance-billing/subscriptionLifecycle.js'
import { buildBillingManageSummaryResponse } from './insurance-billing/billingManageService.js'
import {
  approveInsuranceBillingPaymentAdmin,
  cancelInsuranceBillingPaymentAdmin,
  getInsuranceBillingPaymentAdmin,
  listInsuranceBillingPaymentsAdmin,
} from './insurance-billing/paymentAdminService.js'
import { getInsurancePaymentProvider } from './insurance-billing/providers/index.js'
import {
  activateBillingPromotionCodeAdmin,
  createBillingPromotionCodeAdmin,
  deactivateBillingPromotionCodeAdmin,
  getBillingPromotionCodeAdminById,
  getBillingPromotionCodeStatsAdmin,
  listBillingPromotionCodesAdmin,
  parseCreateBillingPromotionInput,
  parseUpdateBillingPromotionInput,
  softDeleteBillingPromotionCodeAdmin,
  updateBillingPromotionCodeAdmin,
} from './insurance-billing/promotionAdminService.js'
import {
  buildApplyPromotionSuccessPayload,
} from './insurance-billing/applyPromotionResponse.js'
import { isSubscriptionSubjectRole } from './subscription/policy.js'

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {Function} ctx.requireAuth
 * @param {Function} ctx.handleDbError
 */
export function registerInsuranceBillingApi(apiRouter, ctx) {
  const { pool, requireAuth, requireSuperAdmin, handleDbError } = ctx

  function requireBillingEnabled(_req, res, next) {
    if (!isInsuranceBillingEnabled()) {
      res.status(404).json({ message: '결제단이 활성화되지 않았습니다.' })
      return
    }
    next()
  }

  function requireBillingSubject(req, res, next) {
    if (!isSubscriptionSubjectRole(req.user?.role)) {
      res.status(403).json({ message: '결제 기능을 이용할 수 없는 계정입니다.' })
      return
    }
    next()
  }

  apiRouter.get('/billing/checkout/summary', requireAuth, requireBillingEnabled, requireBillingSubject, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      const summary = await getCheckoutSummary(pool, userId)
      res.json({
        ...summary,
        billingEnabled: true,
        enforceAccess: process.env.INSURANCE_BILLING_ENFORCE_ACCESS === 'true',
        provider: getInsuranceBillingProvider(),
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/billing/promotion-codes/validate', requireAuth, requireBillingEnabled, requireBillingSubject, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      const code = String(req.body?.code ?? '').trim()
      const planCode = String(req.body?.planCode ?? req.body?.plan_code ?? 'insurance_basic').trim()
      const billingCycle = String(req.body?.billingCycle ?? req.body?.billing_cycle ?? 'monthly').trim()
      const result = await validateInsurancePromotionCode(pool, { code, planCode, billingCycle, userId })
      res.json(result)
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/billing/checkout/apply-promotion', requireAuth, requireBillingEnabled, requireBillingSubject, async (req, res) => {
    const client = await pool.connect()
    try {
      const userId = String(req.user?.id ?? '').trim()
      const code = String(req.body?.code ?? '').trim()
      const planCode = String(req.body?.planCode ?? req.body?.plan_code ?? 'insurance_basic').trim()
      const billingCycle = String(req.body?.billingCycle ?? req.body?.billing_cycle ?? 'monthly').trim()

      const validation = await validateInsurancePromotionCode(pool, { code, planCode, billingCycle, userId })
      if (!validation.valid) {
        res.status(400).json(validation)
        return
      }

      const row = await loadPromotionCodeRow(pool, { code })
      if (!row) {
        res.status(400).json({ valid: false, message: '유효하지 않은 코드입니다.' })
        return
      }

      await client.query('BEGIN')

      if (String(row.type) === 'free_months') {
        const applied = await applyFreeMonthsPromotion(client, {
          userId,
          promotionRow: row,
          planCode,
          billingCycle,
        })
        await client.query('COMMIT')
        res.json(
          buildApplyPromotionSuccessPayload(applied, { code: row.code }),
        )
        return
      }

      await client.query('ROLLBACK')
      res.status(400).json({ valid: false, message: '결제 단계에서 지원하지 않는 코드 유형입니다. 무료 이용권 코드만 적용할 수 있습니다.' })
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* */
      }
      if (e?.message === 'promotion_already_used') {
        res.status(409).json({
          valid: false,
          message: '이미 프로모션 코드를 사용한 계정입니다.',
          errorCode: PROMOTION_ALREADY_USED_ERROR_CODE,
        })
        return
      }
      handleDbError(e, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.post('/billing/mock-payments/complete', requireAuth, requireBillingEnabled, requireBillingSubject, async (req, res) => {
    if (!isMockPaymentAllowed()) {
      res.status(403).json({ message: 'mock 결제는 develop/test 환경에서만 사용할 수 있습니다.' })
      return
    }
    const client = await pool.connect()
    try {
      const userId = String(req.user?.id ?? '').trim()
      const planCode = String(req.body?.planCode ?? req.body?.plan_code ?? 'insurance_basic').trim()
      const billingCycle = String(req.body?.billingCycle ?? req.body?.billing_cycle ?? 'monthly').trim()
      await client.query('BEGIN')
      const provider = getInsurancePaymentProvider()
      const result = await provider.completePayment(client, { userId, planCode, billingCycle })
      await client.query('COMMIT')
      res.json({ ok: true, ...result })
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* */
      }
      const code = e?.message ?? ''
      if (code === 'plan_not_found') {
        res.status(404).json({ message: '요금제를 찾을 수 없습니다.' })
        return
      }
      if (code === 'subscription_not_found') {
        res.status(404).json({ message: '구독 정보를 찾을 수 없습니다.' })
        return
      }
      if (code === 'payment_already_pending') {
        res.status(409).json({ message: '이미 처리 대기 중인 결제 요청이 있습니다.' })
        return
      }
      handleDbError(e, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.post('/billing/payments/request', requireAuth, requireBillingEnabled, requireBillingSubject, async (req, res) => {
    const client = await pool.connect()
    try {
      const userId = String(req.user?.id ?? '').trim()
      const planCode = String(req.body?.planCode ?? req.body?.plan_code ?? 'insurance_basic').trim()
      const billingCycle = String(req.body?.billingCycle ?? req.body?.billing_cycle ?? 'monthly').trim()
      const promotionCode = req.body?.promotionCode ?? req.body?.promotion_code ?? null
      await client.query('BEGIN')
      const result = await requestInsurancePayment(client, {
        userId,
        planCode,
        billingCycle,
        promotionCode,
      })
      await client.query('COMMIT')
      res.status(201).json({ ok: true, ...result })
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* */
      }
      const code = e?.message ?? ''
      if (code === 'plan_not_found') {
        res.status(404).json({ message: '요금제를 찾을 수 없습니다.' })
        return
      }
      if (code === 'subscription_not_found') {
        res.status(404).json({ message: '구독 정보를 찾을 수 없습니다.' })
        return
      }
      if (code === 'payment_already_pending') {
        res.status(409).json({ message: '이미 처리 대기 중인 결제 요청이 있습니다.' })
        return
      }
      handleDbError(e, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.get('/billing/manage/summary', requireAuth, requireBillingEnabled, requireBillingSubject, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      const payload = await buildBillingManageSummaryResponse(pool, userId)
      res.json(payload)
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  if (typeof requireSuperAdmin === 'function') {
    apiRouter.post('/admin/billing/promotion-codes', requireAuth, requireSuperAdmin, async (req, res) => {
      try {
        const input = parseCreateBillingPromotionInput(req.body)
        const row = await createBillingPromotionCodeAdmin(pool, {
          ...input,
          adminUserId: String(req.user?.id ?? ''),
        })
        res.status(201).json({ row })
      } catch (e) {
        const code = e?.message ?? ''
        if (code === 'promotion_code_required') {
          res.status(400).json({ message: '코드를 입력해 주세요.' })
          return
        }
        if (code === 'promotion_name_required') {
          res.status(400).json({ message: '코드 이름을 입력해 주세요.' })
          return
        }
        if (code === 'promotion_free_months_required') {
          res.status(400).json({ message: '무료 개월 수는 1 이상이어야 합니다.' })
          return
        }
        if (code === 'promotion_free_months_max') {
          res.status(400).json({ message: '무료 개월 수는 12 이하여야 합니다.' })
          return
        }
        if (code === 'promotion_code_duplicate') {
          res.status(409).json({ message: '이미 사용 중인 코드입니다.' })
          return
        }
        if (code === 'promotion_type_invalid') {
          res.status(400).json({ message: '지원하지 않는 프로모션 유형입니다.' })
          return
        }
        if (code === 'promotion_amount_off_required' || code === 'promotion_percent_off_required') {
          res.status(400).json({ message: '할인 값을 올바르게 입력해 주세요.' })
          return
        }
        handleDbError(e, req, res)
      }
    })

    apiRouter.get('/admin/billing/promotion-codes', requireAuth, requireSuperAdmin, async (req, res) => {
      try {
        const filter = String(req.query?.filter ?? 'all')
        const rows = await listBillingPromotionCodesAdmin(pool, { filter })
        res.json({ rows })
      } catch (e) {
        handleDbError(e, req, res)
      }
    })

    apiRouter.get('/admin/billing/promotion-codes/:codeId/stats', requireAuth, requireSuperAdmin, async (req, res) => {
      try {
        const codeId = Number(req.params.codeId)
        if (!Number.isFinite(codeId) || codeId <= 0) {
          res.status(400).json({ message: '유효하지 않은 코드 ID입니다.' })
          return
        }
        const stats = await getBillingPromotionCodeStatsAdmin(pool, codeId)
        res.json(stats)
      } catch (e) {
        if (e?.message === 'promotion_not_found') {
          res.status(404).json({ message: '프로모션 코드를 찾을 수 없습니다.' })
          return
        }
        handleDbError(e, req, res)
      }
    })

    apiRouter.patch('/admin/billing/promotion-codes/:codeId', requireAuth, requireSuperAdmin, async (req, res) => {
      try {
        const codeId = Number(req.params.codeId)
        if (!Number.isFinite(codeId) || codeId <= 0) {
          res.status(400).json({ message: '유효하지 않은 코드 ID입니다.' })
          return
        }
        const current = await getBillingPromotionCodeAdminById(pool, codeId)
        if (!current) {
          res.status(404).json({ message: '프로모션 코드를 찾을 수 없습니다.' })
          return
        }
        const input = parseUpdateBillingPromotionInput({
          ...req.body,
          code: current.code,
        })
        const row = await updateBillingPromotionCodeAdmin(pool, {
          codeId,
          adminUserId: String(req.user?.id ?? ''),
          code: current.code,
          ...input,
        })
        res.json({ row })
      } catch (e) {
        const code = e?.message ?? ''
        if (code === 'promotion_not_found') {
          res.status(404).json({ message: '프로모션 코드를 찾을 수 없습니다.' })
          return
        }
        if (code === 'promotion_deleted') {
          res.status(409).json({ message: '삭제된 코드는 수정할 수 없습니다.' })
          return
        }
        if (code === 'promotion_free_months_required' || code === 'promotion_free_months_max') {
          res.status(400).json({ message: '무료 개월 수를 올바르게 입력해 주세요.' })
          return
        }
        handleDbError(e, req, res)
      }
    })

    apiRouter.delete('/admin/billing/promotion-codes/:codeId', requireAuth, requireSuperAdmin, async (req, res) => {
      try {
        const codeId = Number(req.params.codeId)
        if (!Number.isFinite(codeId) || codeId <= 0) {
          res.status(400).json({ message: '유효하지 않은 코드 ID입니다.' })
          return
        }
        const result = await softDeleteBillingPromotionCodeAdmin(pool, {
          codeId,
          adminUserId: String(req.user?.id ?? ''),
        })
        res.json(result)
      } catch (e) {
        if (e?.message === 'promotion_not_found') {
          res.status(404).json({ message: '프로모션 코드를 찾을 수 없습니다.' })
          return
        }
        handleDbError(e, req, res)
      }
    })

    apiRouter.patch(
      '/admin/billing/promotion-codes/:codeId/activate',
      requireAuth,
      requireSuperAdmin,
      async (req, res) => {
        try {
          const codeId = Number(req.params.codeId)
          if (!Number.isFinite(codeId) || codeId <= 0) {
            res.status(400).json({ message: '유효하지 않은 코드 ID입니다.' })
            return
          }
          const result = await activateBillingPromotionCodeAdmin(pool, {
            codeId,
            adminUserId: String(req.user?.id ?? ''),
          })
          res.json(result)
        } catch (e) {
          if (e?.message === 'promotion_not_found') {
            res.status(404).json({ message: '프로모션 코드를 찾을 수 없습니다.' })
            return
          }
          if (e?.message === 'promotion_deleted') {
            res.status(409).json({ message: '삭제된 코드는 활성화할 수 없습니다.' })
            return
          }
          handleDbError(e, req, res)
        }
      },
    )

    apiRouter.patch(
      '/admin/billing/promotion-codes/:codeId/deactivate',
      requireAuth,
      requireSuperAdmin,
      async (req, res) => {
        try {
          const codeId = Number(req.params.codeId)
          if (!Number.isFinite(codeId) || codeId <= 0) {
            res.status(400).json({ message: '유효하지 않은 코드 ID입니다.' })
            return
          }
          const result = await deactivateBillingPromotionCodeAdmin(pool, {
            codeId,
            adminUserId: String(req.user?.id ?? ''),
          })
          res.json(result)
        } catch (e) {
          if (e?.message === 'promotion_not_found') {
            res.status(404).json({ message: '프로모션 코드를 찾을 수 없습니다.' })
            return
          }
          if (e?.message === 'promotion_deleted') {
            res.status(409).json({ message: '삭제된 코드는 변경할 수 없습니다.' })
            return
          }
          handleDbError(e, req, res)
        }
      },
    )

    apiRouter.get('/admin/billing/payments', requireAuth, requireSuperAdmin, async (req, res) => {
      try {
        const result = await listInsuranceBillingPaymentsAdmin(pool, {
          status: req.query?.status,
          page: req.query?.page,
          limit: req.query?.limit,
          userId: req.query?.userId ?? req.query?.user_id,
          tenantId: req.query?.tenantId ?? req.query?.tenant_id,
        })
        res.json(result)
      } catch (e) {
        if (e?.message === 'invalid_status_filter') {
          res.status(400).json({ message: '유효하지 않은 상태 필터입니다.' })
          return
        }
        handleDbError(e, req, res)
      }
    })

    apiRouter.get('/admin/billing/payments/:paymentId', requireAuth, requireSuperAdmin, async (req, res) => {
      try {
        const item = await getInsuranceBillingPaymentAdmin(pool, req.params.paymentId)
        res.json({ item })
      } catch (e) {
        const code = e?.message ?? ''
        if (code === 'invalid_payment_id') {
          res.status(400).json({ message: '유효하지 않은 결제 ID입니다.' })
          return
        }
        if (code === 'payment_not_found') {
          res.status(404).json({ message: '결제 요청을 찾을 수 없습니다.' })
          return
        }
        handleDbError(e, req, res)
      }
    })

    apiRouter.post('/admin/billing/payments/:paymentId/approve', requireAuth, requireSuperAdmin, async (req, res) => {
      const client = await pool.connect()
      try {
        const paymentId = req.params.paymentId
        const adminUserId = String(req.user?.id ?? '').trim()
        await client.query('BEGIN')
        const result = await approveInsuranceBillingPaymentAdmin(client, paymentId, adminUserId)
        await client.query('COMMIT')
        res.json({ ok: true, ...result })
      } catch (e) {
        try {
          await client.query('ROLLBACK')
        } catch {
          /* */
        }
        const code = e?.message ?? ''
        if (code === 'invalid_payment_id') {
          res.status(400).json({ message: '유효하지 않은 결제 ID입니다.' })
          return
        }
        if (code === 'payment_not_found') {
          res.status(404).json({ message: '결제 요청을 찾을 수 없습니다.' })
          return
        }
        if (code === 'payment_not_pending') {
          res.status(409).json({ message: '대기 중인 결제 요청만 승인할 수 있습니다.' })
          return
        }
        handleDbError(e, req, res)
      } finally {
        client.release()
      }
    })

    apiRouter.post('/admin/billing/payments/:paymentId/cancel', requireAuth, requireSuperAdmin, async (req, res) => {
      const client = await pool.connect()
      try {
        const paymentId = req.params.paymentId
        const adminUserId = String(req.user?.id ?? '').trim()
        const cancelReason = req.body?.cancelReason ?? req.body?.cancel_reason ?? null
        await client.query('BEGIN')
        const result = await cancelInsuranceBillingPaymentAdmin(client, paymentId, adminUserId, cancelReason)
        await client.query('COMMIT')
        res.json({ ok: true, ...result })
      } catch (e) {
        try {
          await client.query('ROLLBACK')
        } catch {
          /* */
        }
        const code = e?.message ?? ''
        if (code === 'invalid_payment_id') {
          res.status(400).json({ message: '유효하지 않은 결제 ID입니다.' })
          return
        }
        if (code === 'payment_not_found') {
          res.status(404).json({ message: '결제 요청을 찾을 수 없습니다.' })
          return
        }
        if (code === 'payment_not_pending') {
          res.status(409).json({ message: '대기 중인 결제 요청만 취소할 수 있습니다.' })
          return
        }
        handleDbError(e, req, res)
      } finally {
        client.release()
      }
    })
  }
}

export { enforceInsuranceBillingEntitlement }
