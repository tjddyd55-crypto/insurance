import type { SmsBulkSearchCustomer } from '../types/smsBulkRecipient.types'

export type SmsSendGroupSummary = {
  total: number
  sendable: number
  excluded: number
}

export function buildSmsSendGroupSummary(customers: Pick<SmsBulkSearchCustomer, 'canSend'>[]): SmsSendGroupSummary {
  const total = customers.length
  const sendable = customers.filter((row) => row.canSend).length
  return {
    total,
    sendable,
    excluded: total - sendable,
  }
}

export function buildSmsSendCustomerIdsText(customers: Pick<SmsBulkSearchCustomer, 'customerId'>[]): string {
  return customers.map((row) => row.customerId).join(', ')
}

export type SmsSendGroupFetchDecision = 'skip-empty' | 'use-cache' | 'fetch'

export function resolveSmsSendGroupFetchDecision(
  selectedGroupId: string,
  cache: ReadonlyMap<string, unknown>,
): SmsSendGroupFetchDecision {
  if (!selectedGroupId.trim()) {
    return 'skip-empty'
  }
  if (cache.has(selectedGroupId)) {
    return 'use-cache'
  }
  return 'fetch'
}
