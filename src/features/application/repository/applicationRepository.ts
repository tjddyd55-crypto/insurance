import { buildApplicationTitle } from '../domain/title'
import type {
  InsuranceApplicationFormData,
  InsuranceApplicationRecord,
} from '../domain/types'
import {
  APPLICATION_DRAFT_STORAGE_KEY,
  APPLICATION_STORAGE_KEY,
} from './storageKeys'

interface ApplicationDraftPayload {
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

function readRecords(): InsuranceApplicationRecord[] {
  const parsed = safeParse<InsuranceApplicationRecord[]>(
    window.localStorage.getItem(APPLICATION_STORAGE_KEY),
    [],
  )

  return [...parsed].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function writeRecords(records: InsuranceApplicationRecord[]): void {
  window.localStorage.setItem(APPLICATION_STORAGE_KEY, JSON.stringify(records))
}

export function listApplications(): InsuranceApplicationRecord[] {
  return readRecords()
}

export function getApplicationById(id: string): InsuranceApplicationRecord | null {
  return readRecords().find((record) => record.id === id) ?? null
}

export function saveApplication(
  payload: InsuranceApplicationFormData,
  id?: string,
): InsuranceApplicationRecord {
  const records = readRecords()
  const now = new Date().toISOString()

  if (id) {
    const target = records.find((record) => record.id === id)
    if (target) {
      const updatedRecord: InsuranceApplicationRecord = {
        ...target,
        ...payload,
        title: buildApplicationTitle(payload),
        updatedAt: now,
      }

      const nextRecords = records.map((record) =>
        record.id === id ? updatedRecord : record,
      )
      writeRecords(nextRecords)
      return updatedRecord
    }
  }

  const createdRecord: InsuranceApplicationRecord = {
    ...payload,
    id: crypto.randomUUID(),
    title: buildApplicationTitle(payload),
    createdAt: now,
    updatedAt: now,
  }

  writeRecords([createdRecord, ...records])
  return createdRecord
}

export function saveApplicationAsNew(
  payload: InsuranceApplicationFormData,
): InsuranceApplicationRecord {
  return saveApplication(payload)
}

export function saveDraft(
  data: InsuranceApplicationFormData,
  id?: string,
): ApplicationDraftPayload {
  const draft: ApplicationDraftPayload = {
    id,
    data,
    savedAt: new Date().toISOString(),
  }

  window.localStorage.setItem(APPLICATION_DRAFT_STORAGE_KEY, JSON.stringify(draft))
  return draft
}

export function getDraft(): ApplicationDraftPayload | null {
  return safeParse<ApplicationDraftPayload | null>(
    window.localStorage.getItem(APPLICATION_DRAFT_STORAGE_KEY),
    null,
  )
}

export function clearDraft(): void {
  window.localStorage.removeItem(APPLICATION_DRAFT_STORAGE_KEY)
}
