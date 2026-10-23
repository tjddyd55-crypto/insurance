import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildSeedScenarioTemplate } from '../domain/scenarioSeed'
import { createConsultationFromTemplate } from '../domain/templateOperations'
import { getConsultationById, saveConsultation } from './consultationRepository'
import { COVERAGE_SIMULATOR_PREVIEW_PC_USER_KEY } from './scenarioRepository'
import {
  deleteScenarioTemplate,
  getScenarioTemplateById,
  listScenarioTemplates,
  saveScenarioTemplate,
} from './templateRepository'
import { previewTemplateStorageKey, scenarioLibraryInitStorageKey } from './previewStorageKeys'

const userKey = COVERAGE_SIMULATOR_PREVIEW_PC_USER_KEY

function clearStorage() {
  const templateKey = previewTemplateStorageKey(userKey)!
  const initKey = scenarioLibraryInitStorageKey(userKey)!
  localStorage.removeItem(templateKey)
  localStorage.removeItem(initKey)
}

describe('templateRepository scenario library', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      store: {} as Record<string, string>,
      getItem(k: string) {
        return this.store[k] ?? null
      },
      setItem(k: string, v: string) {
        this.store[k] = v
      },
      removeItem(k: string) {
        delete this.store[k]
      },
      clear() {
        this.store = {}
      },
    })
    clearStorage()
  })

  it('does not insert system default templates into an empty library', () => {
    const rows = listScenarioTemplates(userKey)
    expect(rows).toEqual([])
    expect(localStorage.getItem(previewTemplateStorageKey(userKey)!)).toBeNull()
  })

  it('lists user templates and hides stored seeds', () => {
    const seed = buildSeedScenarioTemplate('cancer')
    saveScenarioTemplate(userKey, {
      id: 'user-only',
      name: '사용자 시나리오',
      sourceType: 'user',
      items: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    const templateKey = previewTemplateStorageKey(userKey)!
    const stored = JSON.parse(localStorage.getItem(templateKey) ?? '[]') as unknown[]
    localStorage.setItem(templateKey, JSON.stringify([...(seed ? [seed] : []), ...stored]))

    const rows = listScenarioTemplates(userKey)
    expect(rows.map((row) => row.id)).toEqual(['user-only'])
    expect(getScenarioTemplateById(userKey, seed!.id)).toBeNull()
    expect(getScenarioTemplateById(userKey, 'user-only')?.name).toBe('사용자 시나리오')
  })

  it('renames a user template', () => {
    const saved = saveScenarioTemplate(userKey, {
      id: 'user-only',
      name: '사용자 시나리오',
      sourceType: 'user',
      items: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    saveScenarioTemplate(userKey, { ...saved, name: '암 집중 치료' })
    expect(getScenarioTemplateById(userKey, saved.id)?.name).toBe('암 집중 치료')
  })

  it('keeps saved consultations when a scenario template is deleted', () => {
    const template = saveScenarioTemplate(userKey, {
      id: 'user-only',
      name: '사용자 시나리오',
      sourceType: 'user',
      items: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    const consultation = saveConsultation(userKey, createConsultationFromTemplate(template))
    deleteScenarioTemplate(userKey, template.id)
    expect(listScenarioTemplates(userKey)).toEqual([])
    expect(getConsultationById(userKey, consultation.id)?.title).toBe(template.name)
    expect(getConsultationById(userKey, consultation.id)?.items).toEqual(consultation.items)
  })
})
