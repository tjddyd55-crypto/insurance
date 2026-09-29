import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SEED_DISEASE_ORDER, seedKeyForDiseaseType } from '../domain/scenarioSeed'
import { createConsultationFromTemplate } from '../domain/templateOperations'
import { getConsultationById, saveConsultation } from './consultationRepository'
import { COVERAGE_SIMULATOR_PREVIEW_PC_USER_KEY } from './scenarioRepository'
import {
  deleteScenarioTemplate,
  ensureScenarioLibraryBootstrap,
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

  it('bootstraps seed scenarios once for an empty library', () => {
    ensureScenarioLibraryBootstrap(userKey)
    const rows = listScenarioTemplates(userKey)
    expect(rows.length).toBe(SEED_DISEASE_ORDER.length)
    expect(rows.some((row) => row.seedKey === seedKeyForDiseaseType('cancer'))).toBe(true)
  })

  it('does not recreate a deleted seed after bootstrap marker is set', () => {
    ensureScenarioLibraryBootstrap(userKey)
    const cancer = listScenarioTemplates(userKey).find(
      (row) => row.seedKey === seedKeyForDiseaseType('cancer'),
    )
    expect(cancer).toBeDefined()
    deleteScenarioTemplate(userKey, cancer!.id)
    const afterDelete = listScenarioTemplates(userKey)
    expect(afterDelete.some((row) => row.seedKey === seedKeyForDiseaseType('cancer'))).toBe(false)
    ensureScenarioLibraryBootstrap(userKey)
    const afterReload = listScenarioTemplates(userKey)
    expect(afterReload.some((row) => row.seedKey === seedKeyForDiseaseType('cancer'))).toBe(false)
  })

  it('allows renaming a seed scenario', () => {
    ensureScenarioLibraryBootstrap(userKey)
    const seed = getScenarioTemplateById(userKey, listScenarioTemplates(userKey)[0].id)!
    saveScenarioTemplate(userKey, { ...seed, name: '암 집중 치료' })
    const updated = getScenarioTemplateById(userKey, seed.id)
    expect(updated?.name).toBe('암 집중 치료')
  })

  it('keeps saved consultations when a scenario template is deleted', () => {
    ensureScenarioLibraryBootstrap(userKey)
    const template = getScenarioTemplateById(userKey, listScenarioTemplates(userKey)[0].id)!
    const consultation = saveConsultation(userKey, createConsultationFromTemplate(template))
    deleteScenarioTemplate(userKey, template.id)
    expect(getConsultationById(userKey, consultation.id)?.title).toBe(template.name)
  })

  it('does not bootstrap seeds when legacy user templates already exist', () => {
    const templateKey = previewTemplateStorageKey(userKey)!
    localStorage.setItem(
      templateKey,
      JSON.stringify([
        {
          id: 'user-only',
          name: '사용자 시나리오',
          sourceType: 'user',
          items: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    )
    ensureScenarioLibraryBootstrap(userKey)
    const rows = listScenarioTemplates(userKey)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('user-only')
  })
})
