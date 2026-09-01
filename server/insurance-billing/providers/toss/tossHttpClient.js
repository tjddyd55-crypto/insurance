/**
 * Toss Payments API HTTP 클라이언트 (자동결제/billing).
 */

import { assertExternalSideEffectAllowed } from '../../../lib/qaSafeMode.js'

const TOSS_API_BASE = 'https://api.tosspayments.com'

/**
 * @param {string} secretKey
 */
export function buildTossAuthorizationHeader(secretKey) {
  const encoded = Buffer.from(`${String(secretKey).trim()}:`, 'utf8').toString('base64')
  return `Basic ${encoded}`
}

/**
 * @param {object} params
 * @param {string} params.secretKey
 * @param {string} params.method
 * @param {string} params.path
 * @param {Record<string, unknown> | null | undefined} [params.body]
 * @param {string | null | undefined} [params.testCode]
 */
export async function tossApiRequest(params) {
  assertExternalSideEffectAllowed(`toss.${String(params.method).toLowerCase()}`)
  const url = `${TOSS_API_BASE}${params.path}`
  const headers = {
    Authorization: buildTossAuthorizationHeader(params.secretKey),
    'Content-Type': 'application/json',
  }
  if (params.testCode) {
    headers['TossPayments-Test-Code'] = String(params.testCode)
  }

  const response = await fetch(url, {
    method: params.method,
    headers,
    body: params.body ? JSON.stringify(params.body) : undefined,
  })

  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { message: text }
  }

  return {
    ok: response.ok,
    status: response.status,
    json,
  }
}

/**
 * @param {{ secretKey: string; authKey: string; customerKey: string; testCode?: string | null }} params
 */
export async function issueTossBillingKey(params) {
  return tossApiRequest({
    secretKey: params.secretKey,
    method: 'POST',
    path: '/v1/billing/authorizations/issue',
    body: {
      authKey: params.authKey,
      customerKey: params.customerKey,
    },
    testCode: params.testCode,
  })
}

/**
 * @param {{ secretKey: string; billingKey: string; customerKey: string; amount: number; orderId: string; orderName: string; testCode?: string | null }} params
 */
export async function chargeTossBillingKey(params) {
  const billingKey = encodeURIComponent(params.billingKey)
  return tossApiRequest({
    secretKey: params.secretKey,
    method: 'POST',
    path: `/v1/billing/${billingKey}`,
    body: {
      customerKey: params.customerKey,
      amount: params.amount,
      orderId: params.orderId,
      orderName: params.orderName,
    },
    testCode: params.testCode,
  })
}

/**
 * @param {{ secretKey: string; paymentKey: string }} params
 */
export async function getTossPayment(params) {
  const paymentKey = encodeURIComponent(params.paymentKey)
  return tossApiRequest({
    secretKey: params.secretKey,
    method: 'GET',
    path: `/v1/payments/${paymentKey}`,
  })
}

/**
 * @param {{ secretKey: string; paymentKey: string; cancelReason?: string }} params
 */
export async function cancelTossPayment(params) {
  const paymentKey = encodeURIComponent(params.paymentKey)
  return tossApiRequest({
    secretKey: params.secretKey,
    method: 'POST',
    path: `/v1/payments/${paymentKey}/cancel`,
    body: {
      cancelReason: params.cancelReason ?? '관리자 취소',
    },
  })
}
