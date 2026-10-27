import { describe, expect, it } from 'vitest'
import { BILLING_ADMIN_TABS, BILLING_ADMIN_TAB_LAYOUT } from './billingAdminTabLayout'
import { buildBillingPlanSelectOptions } from './components/BillingPlanFormDialog'
import type { BillingPlanAdminRow } from './api/billingApi'

function plan(code: string, extra: Partial<BillingPlanAdminRow> = {}): BillingPlanAdminRow {
  return {
    planCode: code, dbCode: code, label: code, supplyAmount: 13545, vatAmount: 1355, totalAmount: 14900,
    vatRate: 0.1, applyVat: true, displayPrice: '14,900원', displayPriceWithVatNote: '14,900원 / 월 (VAT 포함)',
    allowsReferralDiscount: true, referralDiscountStartCount: 1, referralDiscountUnitSupplyAmount: 3000,
    freeReferralCount: null, isActive: true, description: null, cycle: 'monthly', gaUsageCount: 0, userUsageCount: 0,
    ...extra,
  }
}

describe('결제/구독 관리 탭', () => {
  it('추천 할인 정책 탭 제거, 나머지 6개 탭 유지', () => {
    expect(BILLING_ADMIN_TABS.map((t) => t.label)).toEqual([
      '요금제 관리', 'GA 기본 요금', '사용자별 구독/예외', '결제 요청/청구 내역', '프로모션 코드', '결제 연동 설정',
    ])
    expect(Object.keys(BILLING_ADMIN_TAB_LAYOUT)).not.toContain('referral')
  })
})

describe('GA 기본 요금제 드롭다운 옵션', () => {
  it('활성 요금제만 동적으로, "이름 금액 / 월 (VAT 포함)" 형식', () => {
    const opts = buildBillingPlanSelectOptions([plan('ONE FC'), plan('OFF', { isActive: false })])
    expect(opts).toEqual([{ value: 'ONE FC', label: 'ONE FC 14,900원 / 월 (VAT 포함)' }])
  })
  it('이미 선택된 비활성 요금제는 "· 비활성" 표시로 유지', () => {
    const opts = buildBillingPlanSelectOptions([plan('OFF', { isActive: false })], ['OFF'])
    expect(opts[0].label).toBe('OFF 14,900원 / 월 (VAT 포함) · 비활성')
  })
  it('VAT 미적용 요금제 표시', () => {
    expect(buildBillingPlanSelectOptions([plan('N', { applyVat: false })])[0].label).toBe('N 14,900원 / 월 (VAT 미적용)')
  })
})
