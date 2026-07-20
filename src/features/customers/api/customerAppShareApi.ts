import { ApiError, apiRequest } from '../../../lib/apiClient'

function requireToken(token: string): string {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다. 다시 로그인해 주세요.', 401)
  }
  return token.trim()
}

export type CustomerAppSmsAvailability = {
  available: boolean
  reason: string | null
}

export type CustomerAppSmsSendResult = {
  status: 'sent' | 'disabled' | 'failed' | 'missing_receiver'
  receiverMasked?: string
  campaignId?: number | null
}

export type CustomerAppAlimtalkShareResult = {
  status: 'dry_run' | 'accepted' | 'sent' | 'blocked' | 'failed' | 'missing_receiver'
  templateKey?: string
  tplCode?: string
  receiverMasked?: string
  provider?: string
  providerMessageId?: string | null
  providerCode?: number | null
  providerMessage?: string | null
}

export async function fetchCustomerAppSmsAvailability(
  token: string,
  customerId: number,
): Promise<CustomerAppSmsAvailability> {
  const data = await apiRequest<CustomerAppSmsAvailability>(
    `/api/agent/customers/${customerId}/customer-app/sms-availability`,
    { token: requireToken(token) },
  )
  const row = data as CustomerAppSmsAvailability
  return {
    available: Boolean(row?.available),
    reason: typeof row?.reason === 'string' ? row.reason : null,
  }
}

export async function sendCustomerAppSms(
  token: string,
  customerId: number,
  receiver: string,
): Promise<CustomerAppSmsSendResult> {
  const data = await apiRequest<CustomerAppSmsSendResult>(
    `/api/agent/customers/${customerId}/customer-app/sms`,
    {
      token: requireToken(token),
      method: 'POST',
      body: JSON.stringify({ receiver }),
    },
  )
  return data as CustomerAppSmsSendResult
}

export async function sendCustomerAppAlimtalkShare(
  token: string,
  customerId: number,
  receiver: string,
): Promise<CustomerAppAlimtalkShareResult> {
  try {
    const data = await apiRequest<CustomerAppAlimtalkShareResult>(
      `/api/agent/customers/${customerId}/customer-app/alimtalk`,
      {
        token: requireToken(token),
        method: 'POST',
        body: JSON.stringify({ receiver }),
      },
    )
    return data as CustomerAppAlimtalkShareResult
  } catch (error) {
    if (error instanceof ApiError && error.data && typeof error.data === 'object') {
      const status = String((error.data as { status?: string }).status ?? '').trim()
      if (status === 'blocked' || status === 'missing_receiver' || status === 'failed') {
        return {
          ...(error.data as CustomerAppAlimtalkShareResult),
          status: status as CustomerAppAlimtalkShareResult['status'],
        }
      }
    }
    throw error
  }
}
