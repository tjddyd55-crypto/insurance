import { validateReferralCodeForSignup, getReferralSummaryForUser } from './referrals/referralService.js'
import { normalizeReferralCode } from './referrals/referralCode.js'

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
      const codeNorm = normalizeReferralCode(body.referral_code ?? body.referralCode ?? '')
      if (!codeNorm) {
        res.json({ valid: true })
        return
      }
      const result = await validateReferralCodeForSignup(pool, codeNorm)
      if (!result.ok) {
        res.json({ valid: false, message: result.message })
        return
      }
      res.json({ valid: true, message: '추천 코드가 적용되었습니다.' })
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
