/** @typedef {'virtual' | 'live'} PaymentMode */
/** @typedef {'toss' | 'none'} PaymentProvider */
/** @typedef {'pending' | 'paid' | 'failed' | 'cancelled' | 'expired'} InvoiceStatus */
/** @typedef {'none' | 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired'} BillingSubscriptionStatus */

export const MONTHLY_BASIC_PLAN_CODE = 'monthly_basic'
export const MONTHLY_BASIC_PLAN_NAME = '월 이용료'
export const BILLING_CYCLE_MONTHLY = 'monthly'

export const INVOICE_STATUSES = Object.freeze(['pending', 'paid', 'failed', 'cancelled', 'expired'])
export const BILLING_SUBSCRIPTION_STATUSES = Object.freeze([
  'none',
  'trial',
  'active',
  'past_due',
  'cancelled',
  'expired',
])

export const REFUND_POLICY_NOTICE = Object.freeze([
  '월 단위 선불 결제입니다.',
  '결제 완료 후 해당 이용기간이 시작되면 환불이 제한될 수 있습니다.',
  '해지 시 다음 결제일부터 과금이 중단됩니다.',
  '이미 결제된 이용기간은 만료일까지 이용할 수 있습니다.',
  '단순 변심·미사용·추천코드 사후 입력은 소급 환불 대상이 아닙니다.',
  '중복 결제·오결제·해지 후 결제·회사 귀책 사유는 확인 후 환불할 수 있습니다.',
])
