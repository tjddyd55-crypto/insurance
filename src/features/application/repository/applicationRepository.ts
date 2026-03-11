import { buildApplicationTitle } from '../domain/title'
import { createEmptyApplicationForm } from '../domain/defaults'
import type {
  InsuranceApplicationFormData,
  InsuranceApplicationRecord,
} from '../domain/types'
import { apiRequest } from '../../../lib/apiClient'
import {
  APPLICATION_DRAFT_STORAGE_KEY,
} from './storageKeys'

interface ApplicationDraftPayload {
  userId?: string
  id?: string
  data: InsuranceApplicationFormData
  savedAt: string
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function mapRecord(raw: InsuranceApplicationRecord): InsuranceApplicationRecord {
  return {
    ...raw,
    title: raw.title || buildApplicationTitle(raw),
  }
}

function sanitizeFormData(payload: InsuranceApplicationFormData): InsuranceApplicationFormData {
  const sanitized = createEmptyApplicationForm()
  const keys = Object.keys(sanitized) as Array<keyof InsuranceApplicationFormData>
  for (const key of keys) {
    ;(sanitized as unknown as Record<string, string | boolean>)[key] =
      payload[key] as string | boolean
  }
  return sanitized
}

export async function listApplications(token: string): Promise<InsuranceApplicationRecord[]> {
  const response = await apiRequest<InsuranceApplicationRecord[]>('/api/forms', { token })
  return response.map(mapRecord)
}

export async function getApplicationById(
  id: string,
  token: string,
): Promise<InsuranceApplicationRecord | null> {
  try {
    const response = await apiRequest<InsuranceApplicationRecord>(`/api/forms/${id}`, { token })
    return mapRecord(response)
  } catch {
    return null
  }
}

export async function saveApplication(
  payload: InsuranceApplicationFormData,
  token: string,
  id?: string,
): Promise<InsuranceApplicationRecord> {
  const formData = sanitizeFormData(payload)
  const body = {
    customerName: formData.ownerName,
    carNumber: formData.vehicleNumber,
    formData,
  }

  if (id) {
    const response = await apiRequest<InsuranceApplicationRecord>(`/api/forms/${id}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(body),
    })
    return mapRecord(response)
  }

  const response = await apiRequest<InsuranceApplicationRecord>('/api/forms', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
  return mapRecord(response)
}

export async function saveApplicationAsNew(
  payload: InsuranceApplicationFormData,
  token: string,
): Promise<InsuranceApplicationRecord> {
  return saveApplication(payload, token)
}

export async function deleteApplication(id: string, token: string): Promise<void> {
  await apiRequest<void>(`/api/forms/${id}`, {
    method: 'DELETE',
    token,
  })
}

export function saveDraft(
  data: InsuranceApplicationFormData,
  userId?: string,
  id?: string,
): ApplicationDraftPayload {
  const draft: ApplicationDraftPayload = {
    userId,
    id,
    data,
    savedAt: new Date().toISOString(),
  }

  window.localStorage.setItem(APPLICATION_DRAFT_STORAGE_KEY, JSON.stringify(draft))
  return draft
}

export function getDraft(userId?: string): ApplicationDraftPayload | null {
  const draft = safeParse<ApplicationDraftPayload | null>(
    window.localStorage.getItem(APPLICATION_DRAFT_STORAGE_KEY),
    null,
  )

  if (!draft) {
    return null
  }

  if (!draft.userId || !userId || draft.userId === userId) {
    return draft
  }

  return null
}

export function clearDraft(): void {
  window.localStorage.removeItem(APPLICATION_DRAFT_STORAGE_KEY)
}
