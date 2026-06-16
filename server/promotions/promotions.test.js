import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeLegacyReferralBenefit, summarizePromotionBenefit } from './promotionBenefit.js'
import { calculatePromotionDiscountForMonth } from './promotionService.js'
import { normalizePromotionCode } from './promotionCode.js'
import { validatePromotionOrReferralCode } from './validatePromotionOrReferral.js'

test('normalizePromotionCode trims and uppercases', () => {
  assert.equal(normalizePromotionCode(' promo-01 '), 'PROMO-01')
  assert.equal(normalizePromotionCode(''), '')
})

test('calculatePromotionDiscountForMonth — first_month_fixed', () => {
  const promo = {
    discountType: 'first_month_fixed',
    discountAmount: 3000,
    durationMonths: null,
  }
  const first = calculatePromotionDiscountForMonth(promo, { baseSupplyAmount: 8000, monthIndex: 1 })
  const second = calculatePromotionDiscountForMonth(promo, { baseSupplyAmount: 8000, monthIndex: 2 })
  assert.equal(first.promotionDiscountSupplyAmount, 3000)
  assert.equal(first.applicable, true)
  assert.equal(second.promotionDiscountSupplyAmount, 0)
  assert.equal(second.applicable, false)
})

test('calculatePromotionDiscountForMonth — first_month_free', () => {
  const promo = { discountType: 'first_month_free', discountAmount: null, durationMonths: null }
  const first = calculatePromotionDiscountForMonth(promo, { baseSupplyAmount: 8000, monthIndex: 1 })
  assert.equal(first.promotionDiscountSupplyAmount, 8000)
})

test('calculatePromotionDiscountForMonth — recurring_percent within duration', () => {
  const promo = {
    discountType: 'recurring_percent',
    discountPercent: 10,
    durationMonths: 3,
  }
  const m2 = calculatePromotionDiscountForMonth(promo, { baseSupplyAmount: 8000, monthIndex: 2 })
  const m4 = calculatePromotionDiscountForMonth(promo, { baseSupplyAmount: 8000, monthIndex: 4 })
  assert.equal(m2.promotionDiscountSupplyAmount, 800)
  assert.equal(m4.promotionDiscountSupplyAmount, 0)
})

test('calculatePromotionDiscountForMonth — caps discount at base supply', () => {
  const promo = { discountType: 'first_month_fixed', discountAmount: 12000, durationMonths: null }
  const first = calculatePromotionDiscountForMonth(promo, { baseSupplyAmount: 8000, monthIndex: 1 })
  assert.equal(first.promotionDiscountSupplyAmount, 8000)
})

test('summarizePromotionBenefit — legacy referral uses policy amount', () => {
  const legacy = summarizeLegacyReferralBenefit()
  assert.match(legacy, /첫 달/)
  assert.match(legacy, /2,000원\(공급가\)/)
})

test('summarizePromotionBenefit — first month percent', () => {
  const promo = {
    discountType: 'first_month_percent',
    discountPercent: 50,
    discountAmount: null,
    durationMonths: null,
  }
  const text = summarizePromotionBenefit(promo, 8000)
  assert.match(text, /50%/)
  assert.match(text, /4,000원/)
})

test('validatePromotionOrReferralCode — not_found falls back to legacy referral', async () => {
  const legacyCode = 'LEGACY1'
  const executor = {
    query: async (sql, params) => {
      const text = String(sql)
      if (text.includes('promotion_codes') && text.includes('code_normalized')) {
        return { rowCount: 0, rows: [] }
      }
      if (text.includes('referral_codes') && params?.[0] === legacyCode) {
        return {
          rowCount: 1,
          rows: [{ owner_user_id: 'user-referrer', code: legacyCode }],
        }
      }
      if (text.includes('FROM users') && text.includes('status') && params?.[0] === 'user-referrer') {
        return { rowCount: 1, rows: [{ id: 'user-referrer', status: 'active' }] }
      }
      return { rowCount: 0, rows: [] }
    },
  }

  const result = await validatePromotionOrReferralCode(executor, legacyCode)
  assert.equal(result.ok, true)
  assert.equal(result.source, 'legacy_referral')
  assert.equal(result.legacy?.code, legacyCode)
})
