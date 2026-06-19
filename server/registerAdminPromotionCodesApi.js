import {
  createPromotionCodeAdmin,
  disablePromotionCodeAdmin,
  getPromotionCodeAdmin,
  getPromotionCodeStatsAdmin,
  listPromotionCodesAdmin,
  updatePromotionCodeAdmin,
} from './promotions/promotionAdminService.js'
import { generateUniquePromotionCodeAdmin } from './promotions/generatePromotionCode.js'

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {Function} ctx.requireAuth
 * @param {Function} ctx.requireSuperAdmin
 * @param {Function} ctx.handleDbError
 */
export function registerAdminPromotionCodesApi(apiRouter, ctx) {
  const { pool, requireAuth, requireSuperAdmin, handleDbError } = ctx

  function mapPromotionAdminError(e, res) {
    const code = e?.message ?? ''
    const table = /** @type {Record<string, { status: number; message: string }>} */ ({
      promotion_code_required: { status: 400, message: '코드를 입력해 주세요.' },
      promotion_code_length_invalid: { status: 400, message: '코드는 3~32자여야 합니다.' },
      promotion_code_type_invalid: { status: 400, message: '코드 유형이 올바르지 않습니다.' },
      promotion_discount_type_invalid: { status: 400, message: '할인 유형이 올바르지 않습니다.' },
      promotion_owner_type_invalid: { status: 400, message: '소유자 유형이 올바르지 않습니다.' },
      promotion_discount_amount_required: { status: 400, message: '할인 금액을 입력해 주세요.' },
      promotion_discount_percent_required: { status: 400, message: '할인율(1~100)을 입력해 주세요.' },
      promotion_duration_required: { status: 400, message: '반복 할인 기간(개월)을 입력해 주세요.' },
      promotion_max_uses_invalid: { status: 400, message: '최대 사용 횟수는 1 이상이어야 합니다.' },
      promotion_starts_at_invalid: { status: 400, message: '시작일이 올바르지 않습니다.' },
      promotion_ends_at_invalid: { status: 400, message: '종료일이 올바르지 않습니다.' },
      promotion_date_range_invalid: { status: 400, message: '시작일은 종료일보다 이전이어야 합니다.' },
      promotion_code_duplicate: {
        status: 409,
        message: '이미 사용 중인 프로모션 코드입니다. 자동생성을 다시 눌러 주세요.',
      },
      promotion_code_generate_failed: {
        status: 503,
        message: '사용 가능한 코드를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.',
      },
      promotion_not_found: { status: 404, message: '프로모션 코드를 찾을 수 없습니다.' },
    })
    const mapped = table[code]
    if (mapped) {
      res.status(mapped.status).json({ message: mapped.message })
      return true
    }
    return false
  }

  apiRouter.get('/admin/promotion-codes', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const codes = await listPromotionCodesAdmin(pool)
      res.json({ codes })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/admin/promotion-codes', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const actorUserId = String(req.user?.id ?? '').trim() || null
      const created = await createPromotionCodeAdmin(pool, req.body ?? {}, actorUserId)
      res.status(201).json(created)
    } catch (e) {
      if (mapPromotionAdminError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/admin/promotion-codes/generate-code', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const generated = await generateUniquePromotionCodeAdmin(pool)
      res.json(generated)
    } catch (e) {
      if (mapPromotionAdminError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/admin/promotion-codes/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const promo = await getPromotionCodeAdmin(pool, req.params.id)
      res.json(promo)
    } catch (e) {
      if (mapPromotionAdminError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.patch('/admin/promotion-codes/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const updated = await updatePromotionCodeAdmin(pool, req.params.id, req.body ?? {})
      res.json(updated)
    } catch (e) {
      if (mapPromotionAdminError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/admin/promotion-codes/:id/disable', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const updated = await disablePromotionCodeAdmin(pool, req.params.id)
      res.json(updated)
    } catch (e) {
      if (mapPromotionAdminError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/admin/promotion-codes/:id/stats', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const stats = await getPromotionCodeStatsAdmin(pool, req.params.id)
      res.json(stats)
    } catch (e) {
      if (mapPromotionAdminError(e, res)) return
      handleDbError(e, req, res)
    }
  })
}
