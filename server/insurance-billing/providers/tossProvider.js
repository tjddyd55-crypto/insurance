import { requestTossInsurancePayment, completeTossInsurancePayment } from './tossBillingService.js'

/** @type {import('./index.js').InsurancePaymentProvider} */
export const tossProvider = {
  async requestPayment(pool, params) {
    return requestTossInsurancePayment(pool, params)
  },
  async completePayment(pool, params) {
    return completeTossInsurancePayment(pool, params)
  },
}
