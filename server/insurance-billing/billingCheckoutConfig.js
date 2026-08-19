import { getInsuranceBillingProvider, isInsuranceBillingProductionRuntime } from './config.js'
import { resolvePaymentSettingsInternal } from '../billing/paymentSettingsResolve.js'
import {
  ensureBillingProviderCustomerKey,
  getActiveBillingKeyForUser,
} from './billingPaymentCredential.js'

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @param {{ gaCode?: string | null; tenantCode?: string | null; username?: string | null } | null} [_userContext]
 */
export async function buildBillingCheckoutConfig(executor, userId, _userContext = null) {
  const provider = getInsuranceBillingProvider()
  const customerKey = await ensureBillingProviderCustomerKey(executor, userId)
  const credential = await getActiveBillingKeyForUser(executor, userId)

  if (provider !== 'toss') {
    return {
      provider,
      mode: 'virtual',
      clientKey: null,
      enabled: false,
      customerKey: null,
      hasBillingKey: false,
      allowDevTestCharge: false,
    }
  }

  const settings = await resolvePaymentSettingsInternal(executor)
  return {
    provider: settings.provider,
    mode: settings.mode,
    clientKey: settings.clientKey || null,
    enabled: settings.isEnabled && settings.hasClientKey && settings.hasSecretKey,
    customerKey,
    hasBillingKey: Boolean(credential?.billingKey),
    allowDevTestCharge: !isInsuranceBillingProductionRuntime(),
    cardCompany: credential?.cardCompany ?? null,
    cardNumberMasked: credential?.cardNumberMasked ?? null,
  }
}
