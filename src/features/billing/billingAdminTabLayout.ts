import type { AdminTabPanelVariant } from '../admin/components/layout'

export const BILLING_ADMIN_TABS = [
  { id: 'plans', label: '요금제 관리' },
  { id: 'ga-plans', label: 'GA 기본 요금' },
  { id: 'users', label: '사용자별 구독/예외' },
  { id: 'invoices', label: '결제 요청/청구 내역' },
  { id: 'referral', label: '추천 할인 정책' },
  { id: 'promotions', label: '프로모션 코드' },
  { id: 'payment', label: '결제 연동 설정' },
] as const

export type BillingAdminTabId = (typeof BILLING_ADMIN_TABS)[number]['id']

export const BILLING_ADMIN_TAB_LAYOUT: Record<BillingAdminTabId, AdminTabPanelVariant> = {
  plans: 'card',
  'ga-plans': 'wide',
  users: 'wide',
  invoices: 'wide',
  referral: 'card',
  promotions: 'wide',
  payment: 'card',
}
