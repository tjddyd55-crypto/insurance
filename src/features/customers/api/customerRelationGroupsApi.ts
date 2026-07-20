import { ApiError, apiRequest } from '../../../lib/apiClient'

export type RelationGroupType = 'FAMILY' | 'BUSINESS' | 'ETC'

export type RelationGroupMember = {
  customerId: number
  name: string
  phone: string
  relationshipLabel: string
  isCurrentCustomer: boolean
  sortOrder?: number
}

export type CustomerRelationGroup = {
  id: number
  name: string
  groupType: RelationGroupType | string
  memo: string
  members: RelationGroupMember[]
  createdAt?: string
  updatedAt?: string
}

export type CreateRelationGroupMemberInput = {
  customerId: number
  relationshipLabel?: string
}

export type CreateRelationGroupPayload = {
  name: string
  groupType?: RelationGroupType | string
  memo?: string
  members?: CreateRelationGroupMemberInput[]
}

type Envelope<T> = {
  success?: boolean
  data?: T
  message?: string
  code?: string
}

function requireToken(token: string) {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
}

function unwrapData<T>(payload: Envelope<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in (payload as Envelope<T>)) {
    return (payload as Envelope<T>).data as T
  }
  return payload as T
}

export async function listCustomerRelationGroups(
  token: string,
  customerId: number,
): Promise<CustomerRelationGroup[]> {
  requireToken(token)
  const payload = await apiRequest<Envelope<CustomerRelationGroup[]>>(
    `/api/customers/${customerId}/relation-groups`,
    { token },
  )
  const data = unwrapData(payload)
  return Array.isArray(data) ? data : []
}

export async function createCustomerRelationGroup(
  token: string,
  customerId: number,
  body: CreateRelationGroupPayload,
): Promise<CustomerRelationGroup> {
  requireToken(token)
  const payload = await apiRequest<Envelope<CustomerRelationGroup>>(
    `/api/customers/${customerId}/relation-groups`,
    {
      token,
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
  return unwrapData(payload)
}

export async function updateCustomerRelationGroup(
  token: string,
  groupId: number,
  body: { name?: string; groupType?: string; memo?: string },
): Promise<CustomerRelationGroup> {
  requireToken(token)
  const payload = await apiRequest<Envelope<CustomerRelationGroup>>(
    `/api/customer-relation-groups/${groupId}`,
    {
      token,
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  )
  return unwrapData(payload)
}

export async function addCustomerRelationGroupMember(
  token: string,
  groupId: number,
  body: { customerId: number; relationshipLabel?: string },
): Promise<void> {
  requireToken(token)
  await apiRequest(`/api/customer-relation-groups/${groupId}/members`, {
    token,
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateCustomerRelationGroupMemberLabel(
  token: string,
  groupId: number,
  customerId: number,
  relationshipLabel: string,
): Promise<void> {
  requireToken(token)
  await apiRequest(`/api/customer-relation-groups/${groupId}/members/${customerId}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({ relationshipLabel }),
  })
}

export async function removeCustomerRelationGroupMember(
  token: string,
  groupId: number,
  customerId: number,
): Promise<{ groupDeleted?: boolean; remainingMembers?: number }> {
  requireToken(token)
  const payload = await apiRequest<
    Envelope<{ groupDeleted?: boolean; remainingMembers?: number }>
  >(`/api/customer-relation-groups/${groupId}/members/${customerId}`, {
    token,
    method: 'DELETE',
  })
  return unwrapData(payload) ?? {}
}

export async function deleteCustomerRelationGroup(token: string, groupId: number): Promise<void> {
  requireToken(token)
  await apiRequest(`/api/customer-relation-groups/${groupId}`, {
    token,
    method: 'DELETE',
  })
}

export const RELATIONSHIP_LABEL_OPTIONS = [
  '본인',
  '배우자',
  '아버지',
  '어머니',
  '자녀',
  '형제',
  '기타',
] as const
