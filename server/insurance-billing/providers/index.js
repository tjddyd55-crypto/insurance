import { getInsuranceBillingProvider } from '../config.js'
import { completeMockInsurancePayment } from '../subscriptionLifecycle.js'

/**
 * PG Provider 추상화 — Phase 1: mock 만 구현, toss 는 2차 연동.
 */

/** @typedef {{ completePayment: (client: import('pg').PoolClient, params: object) => Promise<object> }} InsurancePaymentProvider */

/** @type {InsurancePaymentProvider} */
const mockProvider = {
  async completePayment(client, params) {
    return completeMockInsurancePayment(client, params)
  },
}

/** @type {InsurancePaymentProvider} */
const tossProviderStub = {
  async completePayment() {
    throw new Error('toss_provider_not_implemented')
  },
}

/** @returns {InsurancePaymentProvider} */
export function getInsurancePaymentProvider() {
  return getInsuranceBillingProvider() === 'toss' ? tossProviderStub : mockProvider
}
