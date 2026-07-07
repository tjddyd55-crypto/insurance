import { sanitizeProviderRaw } from '../smsCredentialsCrypto.js'
import { formatSmsRemainBalanceText } from '../smsBalanceFormat.js'

/** @type {import('./smsProvider.js').SmsProvider} */
export const mockSmsProvider = {
  async send(input) {
    const receiver = String(input.to ?? '').replace(/\D/g, '')
    if (!receiver) {
      return { success: false, errorMessage: '수신번호가 올바르지 않습니다.', raw: sanitizeProviderRaw({ mock: true }) }
    }
    if (String(process.env.SMS_MODULE_MOCK_FAIL ?? '').trim() === '1') {
      return {
        success: false,
        errorMessage: 'mock provider failure',
        raw: sanitizeProviderRaw({ mock: true, reason: 'forced_fail' }),
      }
    }
    return {
      success: true,
      providerMessageId: `mock-${Date.now()}`,
      raw: sanitizeProviderRaw({ mock: true, testmode: true }),
    }
  },

  async getBalance(input) {
    if (!String(input.providerUserId ?? '').trim() || !String(input.apiKey ?? '').trim()) {
      return { success: false, errorMessage: '알리고 계정 정보가 없습니다.' }
    }
    const counts = { sms: 999, lms: 999, mms: 0 }
    return {
      success: true,
      balanceText: formatSmsRemainBalanceText(counts),
      balanceBreakdown: counts,
      raw: sanitizeProviderRaw({ mock: true, SMS_CNT: 999, LMS_CNT: 999, MMS_CNT: 0 }),
    }
  },
}
