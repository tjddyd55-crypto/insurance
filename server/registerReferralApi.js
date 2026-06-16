import { validatePromotionOrReferralCode } from './promotions/validatePromotionOrReferral.js'
import { normalizePromotionCode } from './promotions/promotionCode.js'
import { summarizeLegacyReferralBenefit, summarizePromotionBenefit } from './promotions/promotionBenefit.js'
import { BASE_MONTHLY_PRICE } from './referrals/policy.js'
import { getReferralSummaryForUser } from './referrals/referralService.js'

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
      // 기존 API 경로는 유지하되, 입력란은 "추천/할인 코드"로 확장한다.
      const codeNorm = normalizePromotionCode(body.referral_code ?? body.referralCode ?? body.code ?? '')
      if (!codeNorm) {
        res.json({ valid: true })
        return
      }
      const result = await validatePromotionOrReferralCode(pool, codeNorm)
      if (!result.ok) {
        res.json({ valid: false, message: result.message })
        return
      }
      const benefitSummary =
        result.source === 'promotion_code' && result.promo
          ? summarizePromotionBenefit(result.promo, BASE_MONTHLY_PRICE)
          : result.source === 'legacy_referral'
            ? summarizeLegacyReferralBenefit()
            : undefined
      res.json({
        valid: true,
        source: result.source,
        message: result.message || '코드가 적용되었습니다.',
        benefitSummary,
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
