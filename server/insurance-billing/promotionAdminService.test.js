import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validatePromotionCodeRow } from './promotionService.js'
import {
  assertBillingPromotionCanActivate,
  buildPromotionListWhereClause,
  normalizePromotionListFilter,
  softDeleteBillingPromotionCodeAdmin,
} from './promotionAdminService.js'

describe('billing promotion admin service', () => {
  it('normalizePromotionListFilter defaults to all', () => {
    assert.equal(normalizePromotionListFilter(undefined), 'all')
    assert.equal(normalizePromotionListFilter('active'), 'active')
    assert.equal(normalizePromotionListFilter('deleted'), 'deleted')
  })

  it('buildPromotionListWhereClause hides deleted rows by default', () => {
    assert.match(buildPromotionListWhereClause('all'), /deleted_at IS NULL/)
    assert.match(buildPromotionListWhereClause('deleted'), /deleted_at IS NOT NULL/)
  })

  it('validatePromotionCodeRow rejects deleted row', () => {
    const result = validatePromotionCodeRow(
      {
        code: 'FREE-1M',
        is_active: true,
        deleted_at: new Date().toISOString(),
        starts_at: null,
        ends_at: null,
        used_count: 0,
        max_redemptions: null,
        applies_to_plan_code: 'insurance_basic',
        applies_to_product: 'insurance',
      },
      { planCode: 'insurance_basic' },
    )
    assert.equal(result.valid, false)
    assert.equal(result.message, '사용할 수 없는 코드입니다.')
  })

  it('assertBillingPromotionCanActivate blocks deleted code', () => {
    assert.throws(
      () => assertBillingPromotionCanActivate({ deleted_at: new Date().toISOString() }),
      /promotion_deleted/,
    )
  })

  it('softDeleteBillingPromotionCodeAdmin is idempotent', async () => {
    const state = { deletedAt: null }
    const executor = {
      query: async (sql) => {
        if (String(sql).includes('SELECT * FROM billing_promotion_codes WHERE id')) {
          return {
            rows: [
              {
                id: 1,
                code: 'FREE-1M',
                deleted_at: state.deletedAt,
              },
            ],
          }
        }
        if (String(sql).includes('UPDATE billing_promotion_codes')) {
          state.deletedAt = new Date()
          return { rows: [] }
        }
        if (String(sql).includes('INSERT INTO billing_events')) {
          return { rows: [] }
        }
        return { rows: [] }
      },
    }

    const first = await softDeleteBillingPromotionCodeAdmin(executor, { codeId: 1, adminUserId: 'admin-1' })
    assert.equal(first.success, true)

    const second = await softDeleteBillingPromotionCodeAdmin(executor, { codeId: 1, adminUserId: 'admin-1' })
    assert.equal(second.success, true)
    assert.equal(second.alreadyDeleted, true)
  })
})
