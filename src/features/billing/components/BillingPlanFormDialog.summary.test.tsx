import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../components/dialog/BaseDialog', () => ({
  BaseDialog: (props: Record<string, unknown>) => props.children ?? null,
}))

const { BillingPlanFormDialog } = await import('./BillingPlanFormDialog')

describe('BillingPlanFormDialog 현재 요금제 요약', () => {
  it('월 이용료가 비어 있으면 요약은 계산 전 상태이고 추천 할인금액이 단독 표시되지 않는다', () => {
    const html = renderToStaticMarkup(
      createElement(BillingPlanFormDialog, {
        open: true,
        mode: 'create',
        busy: false,
        error: '',
        onClose: vi.fn(),
        onSubmit: vi.fn(),
        defaultReferralDiscountPerUser: 3000,
      }),
    )
    expect(html).toContain('data-testid="plan-summary-empty"')
    expect(html).toContain('월 이용료를 입력하면 요약이 표시됩니다.')
    expect(html).not.toContain('data-testid="plan-summary"')
    expect(html).not.toContain('유료 추천 1명당 월 3,000원')
    expect(html).not.toContain('무료 이용 조건')
    expect(html).not.toContain('요금제 코드')
    expect(html).not.toContain('monthly_special')
    // 입력칸은 기본값 3,000 그대로 유지
    expect(html).toContain('value="3,000"')
  })
})
