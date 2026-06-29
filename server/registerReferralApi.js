import { validatePromotionCode } from './promotions/promotionService.js'
import { summarizeLegacyReferralBenefit, summarizePromotionBenefit } from './promotions/promotionBenefit.js'
import { normalizePromotionCode } from './promotions/promotionCode.js'
import { BASE_MONTHLY_PRICE } from './referrals/policy.js'
import { validateReferralCodeForSignup, getReferralSummaryForUser } from './referrals/referralService.js'

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {Function} ctx.requireAuth
 * @param {Function} ctx.handleDbError
 */
export function registerReferralApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  function requireProfileUser(req, res, next) {
    if (req.user?.role !== 'USER') {
      res.status(403).json({ message: '프로필은 일반 설계사(USER) 계정에서만 이용할 수 있습니다.' })
      return
    }
    next()
  }

  apiRouter.post('/auth/validate-referral-code', async (req, res) => {
    try {
      const body = req.body ?? {}
      const codeNorm = normalizePromotionCode(body.referral_code ?? body.referralCode ?? body.code ?? '')
      if (!codeNorm) {
        res.json({ valid: true })
        return
      }
      const result = await validateReferralCodeForSignup(pool, codeNorm)
      if (!result.ok) {
        res.json({ valid: false, message: result.message })
        return
      }
      res.json({
        valid: true,
        source: 'legacy_referral',
        message: '추천인 코드가 확인되었습니다.',
        benefitSummary: summarizeLegacyReferralBenefit(),
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/auth/validate-discount-code', async (req, res) => {
    try {
      const body = req.body ?? {}
      const codeNorm = normalizePromotionCode(
        body.discount_code ?? body.discountCode ?? body.promo_code ?? body.promoCode ?? body.code ?? '',
      )
      if (!codeNorm) {
        res.json({ valid: true })
        return
      }
      const result = await validatePromotionCode(pool, codeNorm)
      if (!result.ok || !result.promo) {
        res.json({ valid: false, message: result.message ?? '사용할 수 없는 할인 코드입니다.' })
        return
      }
      res.json({
        valid: true,
        source: 'promotion_code',
        message: '할인 코드가 확인되었습니다.',
        benefitSummary: summarizePromotionBenefit(result.promo, BASE_MONTHLY_PRICE),
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/me/referral-summary', requireAuth, requireProfileUser, async (req, res) => {
    try {
      const uid = String(req.user?.id ?? '').trim()
      const summary = await getReferralSummaryForUser(pool, uid)
      res.json(summary)
    } catch (e) {
      handleDbError(e, req, res)
    }
  })
}
