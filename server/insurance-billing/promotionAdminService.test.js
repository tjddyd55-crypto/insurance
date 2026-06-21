import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validatePromotionCodeRow } from './promotionService.js'
import {
  assertBillingPromotionCanActivate,
  buildPromotionListWhereClause,
  createBillingPromotionCodeAdmin,
  normalizePromotionListFilter,
  parseCreateBillingPromotionInput,
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

  it('parseCreateBillingPromotionInput accepts free_months payload', () => {
    const parsed = parseCreateBillingPromotionInput({
      code: 'YJASSET-FREE-3M',
      name: '영진에셋 3개월 무료',
      type: 'free_months',
      freeMonths: 3,
      appliesToProduct: 'insurance',
      appliesToPlanCode: 'insurance_basic',
    })
    assert.equal(parsed.type, 'free_months')
    assert.equal(parsed.freeMonths, 3)
    assert.equal(parsed.amountOff, null)
    assert.equal(parsed.percentOff, null)
  })

  it('parseCreateBillingPromotionInput maps first month free to free_months=1', () => {
    const parsed = parseCreateBillingPromotionInput({
      code: 'FREE-1M',
      name: '첫 달 무료',
      type: 'free_months',
      freeMonths: 1,
    })
    assert.equal(parsed.freeMonths, 1)
  })

  it('parseCreateBillingPromotionInput rejects missing freeMonths', () => {
    assert.throws(
      () =>
        parseCreateBillingPromotionInput({
          code: 'FREE-X',
          name: 'invalid',
          type: 'free_months',
        }),
      /promotion_free_months_required/,
    )
  })

  it('parseCreateBillingPromotionInput rejects freeMonths above 12', () => {
    assert.throws(
      () =>
        parseCreateBillingPromotionInput({
          code: 'FREE-13M',
          name: 'too long',
          type: 'free_months',
          freeMonths: 13,
        }),
      /promotion_free_months_max/,
    )
  })

  it('createBillingPromotionCodeAdmin inserts free_months row', async () => {
    const inserts = []
    const executor = {
      query: async (sql, params) => {
        if (String(sql).includes('SELECT id FROM billing_promotion_codes WHERE UPPER(code)')) {
          return { rowCount: 0, rows: [] }
        }
        if (String(sql).includes('INSERT INTO billing_promotion_codes')) {
          inserts.push(params)
          return {
            rows: [
              {
                id: 9,
                code: params[0],
                name: params[1],
                type: params[2],
                free_months: params[3],
                percent_off: params[4],
                amount_off: params[5],
                max_redemptions: params[6],
                applies_to_plan_code: params[7],
                applies_to_product: params[8],
                is_active: true,
                used_count: 0,
                per_user_limit: 1,
                starts_at: null,
                ends_at: null,
                deleted_at: null,
                deleted_by: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          }
        }
        if (String(sql).includes('INSERT INTO billing_events')) {
          return { rows: [] }
        }
        return { rows: [] }
      },
    }

    const row = await createBillingPromotionCodeAdmin(executor, {
      adminUserId: 'admin-1',
      code: 'FREE-3M',
      name: '3개월 무료',
      type: 'free_months',
      freeMonths: 3,
      percentOff: null,
      amountOff: null,
      appliesToProduct: 'insurance',
      appliesToPlanCode: 'insurance_basic',
      maxRedemptions: null,
    })

    assert.equal(row.code, 'FREE-3M')
    assert.equal(row.freeMonths, 3)
    assert.equal(inserts[0][2], 'free_months')
    assert.equal(inserts[0][3], 3)
    assert.equal(inserts[0][4], null)
    assert.equal(inserts[0][5], null)
  })
})
