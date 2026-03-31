import { apiRequest } from '../../../lib/apiClient'
import type {
  InsuranceContact,
  InsuranceContactsResponse,
  InsuranceContactUpdate,
  UpsertInsuranceContactPayload,
} from '../domain/types'
import { createVCardContent } from '../utils/vcard'

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
  const content = createVCardContent(contact)
  const blob = new Blob([content], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const safeName = `${contact.companyName}_${contact.managerName}`
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80)

  const link = document.createElement('a')
  link.href = url
  link.download = `${safeName}.vcf`
  link.click()
  URL.revokeObjectURL(url)
}
