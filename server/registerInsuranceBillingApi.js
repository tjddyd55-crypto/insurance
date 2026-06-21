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
import {
  applyFreeMonthsPromotion,
  getBillingReferralForUser,
} from './insurance-billing/subscriptionLifecycle.js'
import { getInsurancePaymentProvider } from './insurance-billing/providers/index.js'
import { isSubscriptionSubjectRole } from './subscription/policy.js'

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {Function} ctx.requireAuth
 * @param {Function} ctx.handleDbError
 */
export function registerInsuranceBillingApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

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
        res.json({
          ok: true,
          status: applied.status,
          trialEndsAt: applied.trialEndsAt,
          freeMonths: applied.freeMonths,
          message: `${applied.freeMonths}개월 무료 이용권이 적용되었습니다.`,
        })
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
      if (e?.message === 'promotion_per_user_limit') {
        res.status(409).json({ valid: false, message: '이미 사용한 코드입니다.' })
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
      handleDbError(e, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.get('/billing/manage/summary', requireAuth, requireBillingEnabled, requireBillingSubject, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      const [summary, subscription, referral] = await Promise.all([
        getCheckoutSummary(pool, userId),
        getInsuranceBillingSubscription(pool, userId),
        getBillingReferralForUser(pool, userId),
      ])
      res.json({ summary, subscription, referral })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })
}

export { enforceInsuranceBillingEntitlement }
