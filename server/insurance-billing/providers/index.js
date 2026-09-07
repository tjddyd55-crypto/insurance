import { getInsuranceBillingProvider } from '../config.js'
import { completeMockInsurancePayment, requestInsurancePayment } from '../subscriptionLifecycle.js'
import { withShortBillingTransaction } from '../billingTransaction.js'
import { tossProvider } from './tossProvider.js'

/**
 * PG Provider 추상화 — mock + Toss billing.
 */

/** @typedef {{ requestPayment: (pool: import('pg').Pool, params: object) => Promise<object>; completePayment: (pool: import('pg').Pool, params: object) => Promise<object> }} InsurancePaymentProvider */

/** @type {InsurancePaymentProvider} */
const mockProvider = {
  async requestPayment(pool, params) {
    return withShortBillingTransaction(pool, async (client) => requestInsurancePayment(client, params))
  },
  async completePayment(pool, params) {
    return withShortBillingTransaction(pool, async (client) => completeMockInsurancePayment(client, params))
  },
}

/**
 * @param {{ gaCode?: string | null; tenantCode?: string | null; username?: string | null } | null | undefined} user
 * @returns {InsurancePaymentProvider}
 */
export function getInsurancePaymentProvider(_user = null) {
  return getInsuranceBillingProvider() === 'toss' ? tossProvider : mockProvider
}
