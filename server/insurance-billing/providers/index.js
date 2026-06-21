import { getInsuranceBillingProvider } from '../config.js'
import { completeMockInsurancePayment, requestInsurancePayment } from '../subscriptionLifecycle.js'

/**
 * PG Provider 추상화 — Phase 1: mock 만 구현, toss 는 2차 연동.
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

/** @type {InsurancePaymentProvider} */
const tossProviderStub = {
  async requestPayment() {
    throw new Error('toss_provider_not_implemented')
  },
  async completePayment() {
    throw new Error('toss_provider_not_implemented')
  },
}

/** @returns {InsurancePaymentProvider} */
export function getInsurancePaymentProvider() {
  return getInsuranceBillingProvider() === 'toss' ? tossProviderStub : mockProvider
}
