import { getInsuranceBillingProvider } from '../config.js'
import { completeMockInsurancePayment, requestInsurancePayment } from '../subscriptionLifecycle.js'
import { isStoreReviewBillingSubject } from '../../lib/storeReviewIdentity.js'
import { tossProvider } from './tossProvider.js'

/**
 * PG Provider 추상화 — mock + Toss billing.
 */

/** @typedef {{ requestPayment: (client: import('pg').PoolClient, params: object) => Promise<object>; completePayment: (client: import('pg').PoolClient, params: object) => Promise<object> }} InsurancePaymentProvider */

/** @type {InsurancePaymentProvider} */
const mockProvider = {
  async requestPayment(client, params) {
    return requestInsurancePayment(client, params)
  },
  async completePayment(client, params) {
    return completeMockInsurancePayment(client, params)
  },
}

/**
 * @param {{ gaCode?: string | null; tenantCode?: string | null; username?: string | null } | null | undefined} user
 * @returns {InsurancePaymentProvider}
 */
export function getInsurancePaymentProvider(user = null) {
  if (user && isStoreReviewBillingSubject(user)) {
    return mockProvider
  }
  return getInsuranceBillingProvider() === 'toss' ? tossProvider : mockProvider
}
