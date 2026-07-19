import { ApiError, apiRequest } from '../../../lib/apiClient'

function requireToken(token: string): string {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다. 다시 로그인해 주세요.', 401)
  }
  return token.trim()
}

export type CustomerRegistrationSmsAvailability = {
  available: boolean
  reason: string | null
}

export type CustomerRegistrationSmsSendResult = {
  status: 'sent' | 'disabled' | 'failed'
  receiverMasked?: string
  campaignId?: number | null
}

export type CustomerRegistrationAlimtalkResult = {
  status: 'dry_run' | 'sent' | 'blocked' | 'failed'
  templateKey?: string
  tplCode?: string
  receiverMasked?: string
  provider?: string
  providerMessageId?: string | null
  providerCode?: number | null
  providerMessage?: string | null
}

export async function fetchCustomerRegistrationLink(token: string): Promise<string> {
  const data = await apiRequest<{ registrationUrl: string }>(
    '/api/agent/customer-registration/link',
    { token: requireToken(token) },
  )
  const url = String((data as { registrationUrl?: string })?.registrationUrl ?? '').trim()
  if (!url) {
    throw new ApiError('고객등록 링크를 만들 수 없습니다.', 400)
  }
  return url
}

export async function fetchCustomerRegistrationSmsAvailability(
  token: string,
): Promise<CustomerRegistrationSmsAvailability> {
  const data = await apiRequest<CustomerRegistrationSmsAvailability>(
    '/api/agent/customer-registration/sms-availability',
    { token: requireToken(token) },
  )
  const row = data as CustomerRegistrationSmsAvailability
  return {
    available: Boolean(row?.available),
    reason: typeof row?.reason === 'string' ? row.reason : null,
  }
}

export async function sendCustomerRegistrationSms(
  token: string,
  receiver: string,
): Promise<CustomerRegistrationSmsSendResult> {
  const data = await apiRequest<CustomerRegistrationSmsSendResult>(
    '/api/agent/customer-registration/sms',
    {
      token: requireToken(token),
      method: 'POST',
      body: JSON.stringify({ receiver }),
    },
  )
  return data as CustomerRegistrationSmsSendResult
}

export async function sendCustomerRegistrationAlimtalk(
  token: string,
  receiver: string,
): Promise<CustomerRegistrationAlimtalkResult> {
  try {
    const data = await apiRequest<CustomerRegistrationAlimtalkResult>(
      '/api/agent/customer-registration/alimtalk',
      {
        token: requireToken(token),
        method: 'POST',
        body: JSON.stringify({ receiver }),
      },
    )
    return data as CustomerRegistrationAlimtalkResult
  } catch (error) {
    if (error instanceof ApiError && error.data && typeof error.data === 'object') {
      const status = String((error.data as { status?: string }).status ?? '').trim()
      if (status === 'blocked' || status === 'failed') {
        return {
          ...(error.data as CustomerRegistrationAlimtalkResult),
          status: status as CustomerRegistrationAlimtalkResult['status'],
        }
      }
    }
    throw error
  }
}
