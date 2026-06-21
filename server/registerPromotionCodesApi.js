import { validatePromotionOrReferralCode } from './promotions/validatePromotionOrReferral.js'
import { normalizePromotionCode } from './promotions/promotionCode.js'
import {
  applyPromotionCodeToAccount,
  getAppliedPromotionForUser,
} from './promotions/promotionService.js'
import { summarizeLegacyReferralBenefit, summarizePromotionBenefit } from './promotions/promotionBenefit.js'
import { createReferralRelationship } from './referrals/referralService.js'
import { ensureReferralCodeForUser } from './referrals/referralCode.js'
import { readPolicyActive } from './subscription/appSettings.js'
import { BASE_MONTHLY_PRICE } from './referrals/policy.js'
import { userWasReferred } from './billing/pricing.js'
import {
  createBillingReferralPending,
  resolveTenantIdForUser,
} from './insurance-billing/subscriptionLifecycle.js'
import { systemQuery } from './utils/dbSafeQuery.js'

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {Function} ctx.requireAuth
 * @param {Function} ctx.handleDbError
 */
export function registerPromotionCodesApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  function buildValidatePayload(result) {
    if (!result.ok) {
      return { valid: false, message: result.message }
    }
    if (result.source === 'promotion_code' && result.promo) {
      return {
        valid: true,
        source: result.source,
        code: result.promo.codeNormalized,
        codeType: result.promo.codeType,
        discountType: result.promo.discountType,
        discountAmount: result.promo.discountAmount,
        discountPercent: result.promo.discountPercent,
        durationMonths: result.promo.durationMonths,
        message: result.message,
        benefitSummary: summarizePromotionBenefit(result.promo, BASE_MONTHLY_PRICE),
      }
    }
    return {
      valid: true,
      source: result.source,
      code: result.codeNormalized,
      message: result.message,
      benefitSummary: result.source === 'legacy_referral' ? summarizeLegacyReferralBenefit() : undefined,
    }
  }

  apiRouter.post('/promotion-codes/validate', async (req, res) => {
    try {
      const body = req.body ?? {}
      const codeNorm = normalizePromotionCode(body.code ?? body.promotion_code ?? body.referral_code ?? '')
      if (!codeNorm) {
        res.json({ valid: true })
        return
      }
      const result = await validatePromotionOrReferralCode(pool, codeNorm)
      res.json(buildValidatePayload(result))
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/promotion-codes/me', requireAuth, async (req, res) => {
    try {
      const uid = String(req.user?.id ?? '').trim()
      if (!uid) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const promo = await getAppliedPromotionForUser(pool, uid)
      if (promo) {
        res.json({
          applied: true,
          source: 'promotion_code',
          code: promo.codeNormalized,
          codeType: promo.codeType,
          discountType: promo.discountType,
          benefitSummary: summarizePromotionBenefit(promo, BASE_MONTHLY_PRICE),
        })
        return
      }
      if (await userWasReferred(pool, uid)) {
        const rel = await systemQuery(
          pool,
          `SELECT code FROM referral_relationships WHERE referred_user_id = $1 LIMIT 1`,
          [uid],
        )
        res.json({
          applied: true,
          source: 'legacy_referral',
          code: rel.rows[0]?.code ? String(rel.rows[0].code) : null,
          benefitSummary: summarizeLegacyReferralBenefit(),
        })
        return
      }
      res.json({ applied: false })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/promotion-codes/apply', requireAuth, async (req, res) => {
    const uid = String(req.user?.id ?? '').trim()
    if (!uid) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return
    }

    const body = req.body ?? {}
    const codeNorm = normalizePromotionCode(body.code ?? body.promotion_code ?? body.referral_code ?? '')
    if (!codeNorm) {
      res.status(400).json({ message: '코드를 입력해 주세요.' })
      return
    }

    let check
    try {
      check = await validatePromotionOrReferralCode(pool, codeNorm)
    } catch (e) {
      handleDbError(e, req, res)
      return
    }
    if (!check.ok) {
      res.status(400).json({ message: check.message })
      return
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      if (check.source === 'promotion_code' && check.promo) {
        const existingPromo = await getAppliedPromotionForUser(client, uid)
        if (existingPromo) {
          await client.query('ROLLBACK')
          res.status(409).json({ message: '이미 코드가 적용된 계정입니다.' })
          return
        }

        await applyPromotionCodeToAccount(client, { userId: uid, promo: check.promo })
        await client.query('COMMIT')
        res.json({
          ok: true,
          source: 'promotion_code',
          code: check.promo.codeNormalized,
          message: check.message,
          benefitSummary: summarizePromotionBenefit(check.promo, BASE_MONTHLY_PRICE),
        })
        return
      }

      if (check.source === 'legacy_referral' && check.legacy) {
        const referred = await userWasReferred(client, uid)
        if (referred) {
          await client.query('ROLLBACK')
          res.status(409).json({ message: '이미 추천 코드가 적용된 계정입니다.' })
          return
        }

        const policyActive = await readPolicyActive()
        await createReferralRelationship(client, {
          referredUserId: uid,
          referrerUserId: check.legacy.referrerUserId,
          code: check.legacy.code,
          policyActive,
        })
        await ensureReferralCodeForUser(client, uid)
        await ensureReferralCodeForUser(client, check.legacy.referrerUserId)
        await createBillingReferralPending(client, {
          referrerUserId: check.legacy.referrerUserId,
          referredUserId: uid,
          referralCode: check.legacy.code,
          tenantId: await resolveTenantIdForUser(client, uid, null),
        })
        await client.query('COMMIT')
        res.json({
          ok: true,
          source: 'legacy_referral',
          code: check.legacy.code,
          message: check.message,
          benefitSummary: summarizeLegacyReferralBenefit(),
        })
        return
      }

      await client.query('COMMIT')
      res.json({ ok: true, message: check.message || '코드가 적용되었습니다.' })
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* */
      }
      if (e?.message === 'promotion_already_applied') {
        res.status(409).json({ message: '이미 코드가 적용된 계정입니다.' })
        return
      }
      if (e?.message === 'promotion_max_uses') {
        res.status(400).json({ message: '사용 횟수가 모두 소진된 코드입니다.' })
        return
      }
      if (e?.message === 'referral_self_not_allowed') {
        res.status(400).json({ message: '본인 추천 코드는 사용할 수 없습니다.' })
        return
      }
      if (e?.message === 'referral_already_applied') {
        res.status(409).json({ message: '이미 추천 코드가 적용된 계정입니다.' })
        return
      }
      handleDbError(e, req, res)
    } finally {
      client.release()
    }
  })
}
