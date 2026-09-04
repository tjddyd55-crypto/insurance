import { aligoSmsProvider } from './providers/aligoSmsProvider.js'
import { gatewaySmsProvider } from './providers/gatewaySmsProvider.js'
import { mockSmsProvider } from './providers/mockSmsProvider.js'
import {
  assertSmsModuleProductionProviderPolicy,
  assertSmsRealSendAllowed,
  getConfiguredSmsModuleProviderMode,
  getSmsModuleRuntimeInfo,
  getSmsOutboundServerIpHint,
  getSmsOutboundServerIpList,
} from './smsModuleConfig.js'

/**
 * @param {import('./providers/smsProvider.js').SmsProvider} provider
 * @returns {import('./providers/smsProvider.js').SmsProvider}
 */
function wrapSmsProviderWithRealSendGuard(provider) {
  return {
    send(input) {
      assertSmsRealSendAllowed()
      return provider.send(input)
    },
    getBalance(input) {
      return provider.getBalance(input)
    },
  }
}

/**
 * @returns {import('./providers/smsProvider.js').SmsProvider}
 */
export function resolveSmsProvider() {
  assertSmsModuleProductionProviderPolicy()
  const mode = getConfiguredSmsModuleProviderMode()
  if (mode === 'mock') {
    return wrapSmsProviderWithRealSendGuard(mockSmsProvider)
  }
  if (mode === 'aligo') {
    return wrapSmsProviderWithRealSendGuard(aligoSmsProvider)
  }
  if (mode === 'gateway') {
    return wrapSmsProviderWithRealSendGuard(gatewaySmsProvider)
  }
  const nodeEnv = String(process.env.NODE_ENV ?? '').trim().toLowerCase()
  if (nodeEnv === 'test') {
    return wrapSmsProviderWithRealSendGuard(mockSmsProvider)
  }
  return wrapSmsProviderWithRealSendGuard(mockSmsProvider)
}

export { getSmsOutboundServerIpHint, getSmsOutboundServerIpList, getSmsModuleRuntimeInfo }
