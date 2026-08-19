import { requestTossInsurancePayment, completeTossInsurancePayment } from './tossBillingService.js'

/** @type {import('./index.js').InsurancePaymentProvider} */
export const tossProvider = {
  async requestPayment(client, params) {
    return requestTossInsurancePayment(client, params)
  },
  async completePayment(client, params) {
    return completeTossInsurancePayment(client, params)
  },
}
