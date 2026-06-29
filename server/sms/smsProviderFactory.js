import { aligoSmsProvider } from './providers/aligoSmsProvider.js'
import { gatewaySmsProvider } from './providers/gatewaySmsProvider.js'
import { mockSmsProvider } from './providers/mockSmsProvider.js'
import {
  assertSmsModuleProductionProviderPolicy,
  getConfiguredSmsModuleProviderMode,
  getSmsModuleRuntimeInfo,
  getSmsOutboundServerIpHint,
} from './smsModuleConfig.js'

/**
 * @returns {import('./providers/smsProvider.js').SmsProvider}
 */
export function resolveSmsProvider() {
  assertSmsModuleProductionProviderPolicy()
  const mode = getConfiguredSmsModuleProviderMode()
  if (mode === 'mock') {
    return mockSmsProvider
  }
  if (mode === 'aligo') {
    return aligoSmsProvider
  }
  if (mode === 'gateway') {
    return gatewaySmsProvider
  }
  const nodeEnv = String(process.env.NODE_ENV ?? '').trim().toLowerCase()
  if (nodeEnv === 'test') {
    return mockSmsProvider
  }
  return mockSmsProvider
}

export { getSmsOutboundServerIpHint, getSmsModuleRuntimeInfo }
