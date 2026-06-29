/**
 * Provider adapter contract (server implementation: server/sms/providers/)
 */
export interface SmsProviderSendInput {
  to: string
  from: string
  message: string
  title?: string
  scheduledAt?: Date | null
  messageType?: 'SMS' | 'LMS' | 'MMS'
}

export interface SmsProviderSendResult {
  success: boolean
  providerMessageId?: string
  errorMessage?: string
  raw?: unknown
}

export interface SmsProviderBalanceInput {
  providerUserId: string
  apiKey: string
}

export interface SmsProviderBalanceResult {
  success: boolean
  balanceText?: string
  raw?: unknown
  errorMessage?: string
}

export interface SmsProvider {
  send(input: SmsProviderSendInput): Promise<SmsProviderSendResult>
  getBalance(input: SmsProviderBalanceInput): Promise<SmsProviderBalanceResult>
}
