import { apiRequest } from '../../../lib/apiClient'
import type {
  InsuranceContact,
  InsuranceContactsResponse,
  InsuranceContactUpdate,
  UpsertInsuranceContactPayload,
} from '../domain/types'
import { createVCardContent, openVCardInContactsApp } from '../utils/vcard'

const API_BASE_PATH =
  (import.meta.env.VITE_API_BASE_PATH as string | undefined)?.replace(/\/$/, '') || '/backend'

export function getVCardDownloadUrl(contactId: string): string {
  return `${API_BASE_PATH}/insurance/contacts/${contactId}/vcard`
}

export async function getInsuranceContacts() {
  return apiRequest<InsuranceContactsResponse>('/api/insurance/contacts')
}

export async function getInsuranceUpdates() {
  return apiRequest<InsuranceContactUpdate[]>('/api/insurance/updates')
}

export async function createInsuranceContact(
  payload: UpsertInsuranceContactPayload,
  token: string,
) {
  return apiRequest<InsuranceContact>('/api/admin/insurance/contacts', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export async function updateInsuranceContact(
  contactId: string,
  payload: UpsertInsuranceContactPayload,
  token: string,
) {
  return apiRequest<InsuranceContact>(`/api/admin/insurance/contacts/${contactId}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload),
  })
}

export async function deleteInsuranceContact(
  contactId: string,
  token: string,
  description?: string,
) {
  return apiRequest<void>(`/api/admin/insurance/contacts/${contactId}`, {
    method: 'DELETE',
    token,
    body: JSON.stringify({ description }),
  })
}

export function downloadVCardFallback(contact: InsuranceContact) {
  openVCardInContactsApp(createVCardContent(contact))
}
