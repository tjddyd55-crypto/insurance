import { describe, expect, it } from 'vitest'
import { buildReferralPaymentPreview } from './pricingPolicy'

describe('buildReferralPaymentPreview (관리자 모달 추천 미리보기)', () => {
  it('14,900 / 3,000 → 5명 이상 무료, 표 0~5명', () => {
    const p = buildReferralPaymentPreview(14900, 3000)
    expect(p.freeReferralCount).toBe(5)
    expect(p.rows.map((r) => r.paymentTotal)).toEqual([14900, 11900, 8900, 5900, 2900, 0])
    expect(p.rows.at(-1)?.isFreeRow).toBe(true)
  })
  it('14,900 / 2,000 → 8명 이상 무료', () => {
    const p = buildReferralPaymentPreview(14900, 2000)
    expect(p.freeReferralCount).toBe(8)
    expect(p.rows.map((r) => r.paymentTotal)).toEqual([14900, 12900, 10900, 8900, 6900, 4900, 2900, 900, 0])
  })
  it('14,900 / 5,000 → 3명 이상 무료', () => {
    const p = buildReferralPaymentPreview(14900, 5000)
    expect(p.freeReferralCount).toBe(3)
    expect(p.rows.map((r) => r.paymentTotal)).toEqual([14900, 9900, 4900, 0])
  })
  it('할인액 0원 → 무료 도달 인원 미표시', () => {
    const p = buildReferralPaymentPreview(14900, 0)
    expect(p.freeReferralCount).toBeNull()
    expect(p.rows).toHaveLength(1)
  })
})
