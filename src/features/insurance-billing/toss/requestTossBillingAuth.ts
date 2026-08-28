import { getPublicOrigin } from '../../../lib/publicOrigin'

const TOSS_SDK_SRC = 'https://js.tosspayments.com/v1/payment'

type TossPaymentsSdk = {
  requestBillingAuth: (
    method: string,
    options: { customerKey: string; successUrl: string; failUrl: string },
  ) => Promise<void>
}

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => TossPaymentsSdk
  }
}

function loadTossPaymentsScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('toss_sdk_unavailable'))
  }
  if (typeof window.TossPayments === 'function') {
    return Promise.resolve()
  }
  const existing = document.querySelector(`script[src="${TOSS_SDK_SRC}"]`)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('toss_sdk_load_failed')))
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = TOSS_SDK_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('toss_sdk_load_failed'))
    document.head.appendChild(script)
  })
}

export async function requestTossBillingAuth(params: {
  clientKey: string
  customerKey: string
  intent: 'register' | 'charge'
  planCode: string
  billingCycle: string
  promotionCode?: string | null
}) {
  await loadTossPaymentsScript()
  if (typeof window.TossPayments !== 'function') {
    throw new Error('toss_sdk_unavailable')
  }
  const origin = getPublicOrigin() || window.location.origin
  const success = new URL('/billing/success', origin)
  success.searchParams.set('intent', params.intent)
  success.searchParams.set('planCode', params.planCode)
  success.searchParams.set('billingCycle', params.billingCycle)
  if (params.promotionCode?.trim()) {
    success.searchParams.set('promotionCode', params.promotionCode.trim())
  }
  const fail = new URL('/billing/fail', origin)
  const tossPayments = window.TossPayments(params.clientKey)
  await tossPayments.requestBillingAuth('카드', {
    customerKey: params.customerKey,
    successUrl: success.toString(),
    failUrl: fail.toString(),
  })
}
