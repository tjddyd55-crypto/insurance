import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createConsultationFromTemplate } from '../domain/templateOperations'
import type { ScenarioTemplate } from '../domain/templateTypes'
import { COVERAGE_SIMULATOR_PREVIEW_PC_USER_KEY } from './scenarioRepository'
import { listConsultationsByTemplateId, saveConsultation } from './consultationRepository'
import { saveScenarioTemplate } from './templateRepository'

const userKey = COVERAGE_SIMULATOR_PREVIEW_PC_USER_KEY

function stubLocalStorage() {
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
}

describe('listConsultationsByTemplateId', () => {
  beforeEach(() => {
    stubLocalStorage()
    localStorage.clear()
  })

  it('returns only simulations created from the given scenario template', () => {
    const template: ScenarioTemplate = saveScenarioTemplate(userKey, {
      id: 'tpl-cancer',
      name: '암 치료',
      sourceType: 'user',
      items: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    const other: ScenarioTemplate = saveScenarioTemplate(userKey, {
      id: 'tpl-heart',
      name: '심장',
      sourceType: 'user',
      items: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    saveConsultation(userKey, createConsultationFromTemplate(template))
    saveConsultation(userKey, createConsultationFromTemplate(other))

    const rows = listConsultationsByTemplateId(userKey, template.id)
    expect(rows).toHaveLength(1)
    expect(rows[0].templateId).toBe('tpl-cancer')
  })
})
