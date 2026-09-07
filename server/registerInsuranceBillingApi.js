import {
  getInsuranceBillingProvider,
  isInsuranceBillingEnabled,
  isInsuranceBillingProductionRuntime,
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
} from './insurance-billing/subscriptionLifecycle.js'
import { buildBillingManageSummaryResponse } from './insurance-billing/billingManageService.js'
import {
  clearPendingBillingCycle,
  resumeAutoRenew,
  scheduleCancelAtPeriodEnd,
  schedulePendingBillingCycle,
} from './insurance-billing/subscriptionManageActions.js'
import { buildCheckoutQuote } from './insurance-billing/checkoutQuoteService.js'
import {
  approveInsuranceBillingPaymentAdmin,
  cancelInsuranceBillingPaymentAdmin,
  getInsuranceBillingPaymentAdmin,
  listInsuranceBillingPaymentsAdmin,
} from './insurance-billing/paymentAdminService.js'
import {
  reconcilePendingInsurancePayment,
  reconcileStalePendingInsurancePayments,
} from './insurance-billing/reconcileInsurancePayment.js'
import { getInsurancePaymentProvider } from './insurance-billing/providers/index.js'
import { buildBillingCheckoutConfig } from './insurance-billing/billingCheckoutConfig.js'
import { confirmTossBillingAuth } from './insurance-billing/providers/tossBillingService.js'
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

  function resolveBillingUserContext(req) {
    return {
      gaCode: req.user?.gaCode ?? req.user?.ga_code ?? null,
      tenantCode: req.user?.tenantCode ?? req.user?.tenant_code ?? null,
      username: req.user?.username ?? null,
    }
  }

  function allowTossTestCode(req) {
    if (isInsuranceBillingProductionRuntime()) {
      return null
    }
    const raw = String(req.body?.testCode ?? req.body?.test_code ?? '').trim()
    return raw || null
  }

  function mapInsuranceBillingError(e, res) {
    const code = e?.message ?? ''
    const table = /** @type {Record<string, { status: number; message: string }>} */ ({
      plan_not_found: { status: 404, message: '요금제를 찾을 수 없습니다.' },
      subscription_not_found: { status: 404, message: '구독 정보를 찾을 수 없습니다.' },
      payment_already_pending: { status: 409, message: '이미 처리 대기 중인 결제 요청이 있습니다.' },
      promotion_invalid: { status: 400, message: '사용할 수 없는 쿠폰입니다.' },
      promotion_requires_apply_path: {
        status: 400,
        message: '무료 이용권은 결제 대신 무료 시작으로 적용해 주세요.',
      },
      billing_change_in_progress: {
        status: 409,
        message: '결제가 진행 중입니다. 결제 완료 후 다시 변경해 주세요.',
      },
      subscription_not_active_paid: {
        status: 409,
        message: '유료 이용 중인 구독만 변경할 수 있습니다.',
      },
      subscription_cancel_scheduled: {
        status: 409,
        message: '자동결제 해지를 먼저 취소해 주세요.',
      },
      subscription_already_canceled: {
        status: 409,
        message: '이미 해지된 구독입니다.',
      },
      period_end_missing: {
        status: 409,
        message: '이용기간 정보가 없어 해지를 예약할 수 없습니다.',
      },
      resume_requires_card: {
        status: 409,
        message: '자동결제를 다시 시작하려면 결제수단을 먼저 등록해 주세요.',
      },
      user_required: { status: 400, message: '사용자 정보가 필요합니다.' },
      billing_customer_key_mismatch: { status: 403, message: '결제 인증 정보가 올바르지 않습니다.' },
      billing_auth_invalid: { status: 400, message: '결제 인증 정보가 올바르지 않습니다.' },
      toss_billing_not_enabled: { status: 400, message: 'Toss 결제가 아직 활성화되지 않았습니다.' },
      payment_secret_storage_unavailable: {
        status: 400,
        message: '결제 시크릿 키를 사용할 수 없습니다. 관리자에게 문의해 주세요.',
      },
      toss_billing_key_missing: { status: 502, message: '결제수단 등록에 실패했습니다.' },
      billing_credential_environment_mismatch: {
        status: 409,
        message: '등록된 결제수단이 현재 결제 환경과 맞지 않습니다. 결제수단을 다시 등록해 주세요.',
      },
      toss_payment_key_missing: { status: 502, message: '결제 승인 결과를 확인할 수 없습니다.' },
    })
    const mapped = table[code]
    if (mapped) {
      res.status(mapped.status).json({ message: mapped.message, errorCode: code, code })
      return true
    }
    if (String(code).startsWith('toss_')) {
      res.status(400).json({
        message: e?.userMessage || '결제 처리에 실패했습니다.',
        errorCode: code,
        providerCode: e?.providerCode ?? null,
      })
      return true
    }
    return false
  }

  apiRouter.get('/billing/checkout/summary', requireAuth, requireBillingEnabled, requireBillingSubject, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      const summary = await getCheckoutSummary(pool, userId)
      const checkoutConfig = await buildBillingCheckoutConfig(pool, userId, resolveBillingUserContext(req))
      res.json({
        ...summary,
        billingEnabled: true,
        enforceAccess: process.env.INSURANCE_BILLING_ENFORCE_ACCESS === 'true',
        provider: getInsuranceBillingProvider(),
        checkoutConfig,
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/billing/checkout/quote', requireAuth, requireBillingEnabled, requireBillingSubject, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      const planCode = String(req.body?.planCode ?? req.body?.plan_code ?? 'insurance_basic').trim()
      const billingCycle = String(req.body?.billingCycle ?? req.body?.billing_cycle ?? 'monthly').trim()
      const promotionCode = String(req.body?.promotionCode ?? req.body?.promotion_code ?? '').trim() || null
      // client amount 무시 — 서버 quote만 사용
      const quote = await buildCheckoutQuote(pool, {
        userId,
        planCode,
        billingCycle,
        promotionCode,
      })
      res.json({ ok: true, quote })
    } catch (e) {
      if (mapInsuranceBillingError(e, res)) return
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
    try {
      const userId = String(req.user?.id ?? '').trim()
      const planCode = String(req.body?.planCode ?? req.body?.plan_code ?? 'insurance_basic').trim()
      const billingCycle = String(req.body?.billingCycle ?? req.body?.billing_cycle ?? 'monthly').trim()
      const provider = getInsurancePaymentProvider(resolveBillingUserContext(req))
      const result = await provider.completePayment(pool, { userId, planCode, billingCycle })
      res.json({ ok: true, ...result })
    } catch (e) {
      if (mapInsuranceBillingError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/billing/checkout/config', requireAuth, requireBillingEnabled, requireBillingSubject, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      const config = await buildBillingCheckoutConfig(pool, userId, resolveBillingUserContext(req))
      res.json(config)
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/billing/payment-methods/auth-confirm', requireAuth, requireBillingEnabled, requireBillingSubject, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      const authKey = String(req.body?.authKey ?? req.body?.auth_key ?? '').trim()
      const customerKey = String(req.body?.customerKey ?? req.body?.customer_key ?? '').trim()
      const result = await confirmTossBillingAuth(pool, {
        userId,
        authKey,
        customerKey,
        testCode: allowTossTestCode(req),
      })
      res.json(result)
    } catch (e) {
      if (mapInsuranceBillingError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/billing/payments/request', requireAuth, requireBillingEnabled, requireBillingSubject, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      const planCode = String(req.body?.planCode ?? req.body?.plan_code ?? 'insurance_basic').trim()
      const billingCycle = String(req.body?.billingCycle ?? req.body?.billing_cycle ?? 'monthly').trim()
      const promotionCode = req.body?.promotionCode ?? req.body?.promotion_code ?? null
      const registerOnly = req.body?.registerOnly === true || req.body?.register_only === true
      const provider = getInsurancePaymentProvider(resolveBillingUserContext(req))
      const result = await provider.requestPayment(pool, {
        userId,
        planCode,
        billingCycle,
        promotionCode,
        registerOnly,
        testCode: allowTossTestCode(req),
      })
      if (result?.needsBillingAuth) {
        const checkoutConfig = await buildBillingCheckoutConfig(pool, userId, resolveBillingUserContext(req))
        res.status(200).json({
          ok: true,
          needsBillingAuth: true,
          checkoutConfig,
        })
        return
      }
      if (result?.needsReconciliation) {
        res.status(202).json({
          ok: false,
          needsReconciliation: true,
          paymentId: result.paymentId ?? null,
          orderId: result.orderId ?? null,
          message: '결제 처리 중입니다. 잠시 후 다시 확인해 주세요.',
        })
        return
      }
      res.status(201).json({ ok: true, ...result })
    } catch (e) {
      if (e && typeof e === 'object' && e.needsReconciliation) {
        res.status(202).json({
          ok: false,
          needsReconciliation: true,
          paymentId: e.paymentId ?? null,
          orderId: e.orderId ?? null,
          message: '결제 처리 중입니다. 잠시 후 다시 확인해 주세요.',
        })
        return
      }
      if (mapInsuranceBillingError(e, res)) return
      handleDbError(e, req, res)
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

  apiRouter.patch('/billing/subscription/billing-cycle', requireAuth, requireBillingEnabled, requireBillingSubject, async (req, res) => {
    const client = await pool.connect()
    try {
      const userId = String(req.user?.id ?? '').trim()
      const rawCycle = String(req.body?.billingCycle ?? req.body?.billing_cycle ?? '').trim().toLowerCase()
      if (rawCycle !== 'monthly' && rawCycle !== 'yearly') {
        res.status(400).json({ message: '요금제 주기는 monthly 또는 yearly만 가능합니다.', errorCode: 'invalid_billing_cycle' })
        return
      }
      await client.query('BEGIN')
      const result = await schedulePendingBillingCycle(client, {
        userId,
        billingCycle: rawCycle,
      })
      await client.query('COMMIT')
      const summary = await buildBillingManageSummaryResponse(pool, userId)
      res.json({ ok: true, ...result, subscription: summary.subscription })
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* */
      }
      if (mapInsuranceBillingError(e, res)) return
      handleDbError(e, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.delete('/billing/subscription/pending-billing-cycle', requireAuth, requireBillingEnabled, requireBillingSubject, async (req, res) => {
    const client = await pool.connect()
    try {
      const userId = String(req.user?.id ?? '').trim()
      await client.query('BEGIN')
      const result = await clearPendingBillingCycle(client, { userId })
      await client.query('COMMIT')
      const summary = await buildBillingManageSummaryResponse(pool, userId)
      res.json({ ok: true, ...result, subscription: summary.subscription })
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* */
      }
      if (mapInsuranceBillingError(e, res)) return
      handleDbError(e, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.post('/billing/subscription/cancel', requireAuth, requireBillingEnabled, requireBillingSubject, async (req, res) => {
    const client = await pool.connect()
    try {
      const userId = String(req.user?.id ?? '').trim()
      await client.query('BEGIN')
      const result = await scheduleCancelAtPeriodEnd(client, { userId })
      await client.query('COMMIT')
      const summary = await buildBillingManageSummaryResponse(pool, userId)
      res.json({ ok: true, ...result, subscription: summary.subscription })
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* */
      }
      if (mapInsuranceBillingError(e, res)) return
      handleDbError(e, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.post('/billing/subscription/resume', requireAuth, requireBillingEnabled, requireBillingSubject, async (req, res) => {
    const client = await pool.connect()
    try {
      const userId = String(req.user?.id ?? '').trim()
      await client.query('BEGIN')
      const result = await resumeAutoRenew(client, { userId })
      await client.query('COMMIT')
      const summary = await buildBillingManageSummaryResponse(pool, userId)
      res.json({ ok: true, ...result, subscription: summary.subscription })
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* */
      }
      if (mapInsuranceBillingError(e, res)) return
      handleDbError(e, req, res)
    } finally {
      client.release()
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

    apiRouter.post('/admin/billing/payments/:paymentId/reconcile', requireAuth, requireSuperAdmin, async (req, res) => {
      try {
        const paymentId = req.params.paymentId
        const result = await reconcilePendingInsurancePayment(pool, { paymentId })
        res.json({ ok: true, ...result })
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
        if (code === 'payment_not_reconcilable') {
          res.status(409).json({ message: '복구할 수 없는 결제 상태입니다.' })
          return
        }
        if (code === 'toss_payment_amount_mismatch' || code === 'toss_payment_order_mismatch') {
          res.status(409).json({ message: '결제 금액 또는 주문번호가 일치하지 않습니다.' })
          return
        }
        handleDbError(e, req, res)
      }
    })

    apiRouter.post('/admin/billing/payments/reconcile-stale', requireAuth, requireSuperAdmin, async (req, res) => {
      try {
        const summary = await reconcileStalePendingInsurancePayments(pool, {
          olderThanMs: Number(req.body?.olderThanMs ?? 120_000),
          limit: Number(req.body?.limit ?? 20),
        })
        res.json({ ok: true, ...summary })
      } catch (e) {
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
