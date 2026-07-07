import { apiRequest } from '../../../lib/apiClient'
import type { SmsBulkSearchCustomer, SmsRecipientGroupSummary } from '../types/smsBulkRecipient.types'

function requireSmsToken(token: string): string {
  if (!token?.trim()) {
    throw new Error('로그인이 필요합니다.')
  }
  return token.trim()
}

export async function fetchSmsRecipientGroups(token: string): Promise<SmsRecipientGroupSummary[]> {
  const raw = await apiRequest<SmsRecipientGroupSummary[]>('/api/sms/recipient-groups', {
    token: requireSmsToken(token),
  })
  return Array.isArray(raw) ? raw : []
}

export async function createSmsRecipientGroup(
  token: string,
  input: { name: string; description?: string; customerIds: number[] },
): Promise<SmsRecipientGroupSummary> {
  return apiRequest<SmsRecipientGroupSummary>('/api/sms/recipient-groups', {
    token: requireSmsToken(token),
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      description: input.description ?? '',
      customerIds: input.customerIds,
    }),
  })
}

export async function updateSmsRecipientGroup(
  token: string,
  groupId: number,
  input: { name?: string; description?: string; customerIds?: number[] },
): Promise<SmsRecipientGroupSummary> {
  return apiRequest<SmsRecipientGroupSummary>(`/api/sms/recipient-groups/${groupId}`, {
    token: requireSmsToken(token),
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function deleteSmsRecipientGroup(token: string, groupId: number): Promise<void> {
  await apiRequest(`/api/sms/recipient-groups/${groupId}`, {
    token: requireSmsToken(token),
    method: 'DELETE',
  })
}

export async function fetchSmsRecipientGroupMembers(
  token: string,
  groupId: number,
): Promise<{ customerIds: number[]; customers: SmsBulkSearchCustomer[] }> {
  const raw = await apiRequest<{ customerIds: number[]; customers: SmsBulkSearchCustomer[] }>(
    `/api/sms/recipient-groups/${groupId}/members`,
    { token: requireSmsToken(token) },
  )
  return {
    customerIds: Array.isArray(raw?.customerIds) ? raw.customerIds : [],
    customers: Array.isArray(raw?.customers) ? raw.customers : [],
  }
}
