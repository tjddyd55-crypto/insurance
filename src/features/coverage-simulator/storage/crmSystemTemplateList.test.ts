import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildSystemTemplateSnapshot } from '../domain/systemTemplateCatalog'
import type { CoverageScenario } from '../domain/types'
import type { ScenarioTemplate } from '../domain/templateTypes'
import { listConsultationsByCustomerId, listConsultationsByTemplateId } from './consultationRepository'
import { persistScenarioTemplate, listScenarioTemplates, removeScenarioTemplate } from './templateRepository'

const userKey = 'crm-user'
const deletedTemplateIds: string[] = []
const deleteCrmUserTemplate = vi.fn(async (id: string) => {
  deletedTemplateIds.push(id)
})

const crm = vi.hoisted(() => ({
  templates: [] as ScenarioTemplate[],
  consultations: [] as CoverageScenario[],
}))

vi.mock('./crmCoverageStorageSession', () => ({
  isCrmCoverageStorageReady: (key: string) => key === 'crm-user',
  listCrmUserTemplates: () => crm.templates,
  getCrmUserTemplateById: (id: string) => crm.templates.find((row) => row.id === id) ?? null,
  listCrmConsultations: () => crm.consultations,
  getCrmConsultationById: (id: string) => crm.consultations.find((row) => row.id === id) ?? null,
  saveCrmUserTemplate: async (template: ScenarioTemplate) => {
    const saved: ScenarioTemplate = {
      ...template,
      id: '99',
      legacyClientId: template.id,
      sourceType: 'user',
    }
    crm.templates.unshift(saved)
    return saved
  },
  deleteCrmUserTemplate: (id: string) => deleteCrmUserTemplate(id),
  duplicateCrmUserTemplate: async (id: string) => {
    const found = crm.templates.find((row) => row.id === id)
    if (!found) throw new Error('missing')
    return found
  },
  saveCrmConsultation: async (scenario: CoverageScenario) => scenario,
  deleteCrmConsultation: async () => {},
}))

function stubLocalStorage() {
  const memory = {
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
  }
  vi.stubGlobal('localStorage', memory)
}

function simulation(partial: Partial<CoverageScenario> & Pick<CoverageScenario, 'id' | 'templateId'>): CoverageScenario {
  return {
    title: '시뮬레이션',
    diseaseType: 'cancer',
    description: '',
    consultationDate: '2026-10-01',
    items: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    customerId: null,
    ...partial,
  }
}

describe('CRM system template list', () => {
  beforeEach(() => {
    crm.templates = []
    crm.consultations = []
    deletedTemplateIds.length = 0
    deleteCrmUserTemplate.mockClear()
    stubLocalStorage()
  })

  it('shows the six system templates plus server templates for a fresh CRM user', () => {
    crm.templates = [
      {
        id: '15',
        name: '내 시나리오',
        sourceType: 'user',
        items: [],
        systemDiseaseType: 'custom',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ]
    const rows = listScenarioTemplates(userKey)
    expect(rows.map((row) => row.name)).toEqual([
      '암 치료',
      '뇌혈관 치료',
      '심장질환 치료',
      '간병/치매',
      '골절/수술',
      '기타',
      '내 시나리오',
    ])
    expect(rows.filter((row) => row.sourceType === 'system').map((row) => row.id)).toEqual([
      'system:cancer',
      'system:cerebrovascular',
      'system:heart',
      'system:care-dementia',
      'system:fracture-surgery',
      'system:custom',
    ])
    expect(localStorage.getItem(`onefc:coverage-simulator:templates:v1:${userKey}`)).toBeNull()
  })

  it('lists system, seed, and legacy seed simulations under the system template without duplicating a migrated copy', () => {
    const cancer = buildSystemTemplateSnapshot('cancer')
    expect(cancer).not.toBeNull()
    localStorage.setItem(
      `onefc:coverage-simulator:templates:v1:${userKey}`,
      JSON.stringify([
        {
          ...cancer,
          id: 'legacy-seed-cancer',
          sourceType: 'user',
          seedKey: 'seed:cancer',
        },
      ]),
    )
    crm.templates = [
      {
        ...cancer!,
        id: '15',
        sourceType: 'user',
        legacyClientId: 'uploaded-seed-cancer',
        seedKey: undefined,
      },
    ]
    crm.consultations = [
      simulation({
        id: 'sim-system',
        templateId: 'system:cancer',
        templateNameSnapshot: '암 치료',
      }),
      simulation({
        id: 'sim-seed-key',
        templateId: 'seed:cancer',
        templateNameSnapshot: '암 치료',
      }),
      simulation({
        id: 'sim-legacy',
        templateId: 'legacy-seed-cancer',
        templateNameSnapshot: '바뀐 이름',
        diseaseType: 'cancer',
      }),
      simulation({
        id: 'sim-orphan',
        templateId: 'orphan-seed-uuid',
        templateNameSnapshot: '암 치료',
        diseaseType: 'cancer',
      }),
      simulation({
        id: 'sim-heart',
        templateId: 'system:heart',
        diseaseType: 'heart',
        templateNameSnapshot: '심장질환 치료',
      }),
      simulation({
        id: 'sim-customer',
        templateId: 'system:cancer',
        templateNameSnapshot: '암 치료',
        customerId: '42',
      }),
      simulation({
        id: 'sim-other-customer',
        templateId: 'orphan-seed-uuid',
        templateNameSnapshot: '암 치료',
        customerId: '99',
      }),
    ]

    const rows = listScenarioTemplates(userKey)
    expect(rows.some((row) => row.id === 'system:cancer')).toBe(false)
    expect(rows.some((row) => row.id === '15')).toBe(true)
    expect(rows.filter((row) => row.name === '암 치료')).toHaveLength(1)
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length)

    const cancerSims = listConsultationsByTemplateId(userKey, '15').map((row) => row.id)
    expect(cancerSims).toEqual(
      expect.arrayContaining(['sim-system', 'sim-seed-key', 'sim-legacy', 'sim-orphan', 'sim-customer', 'sim-other-customer']),
    )
    expect(cancerSims).not.toContain('sim-heart')
    expect(listConsultationsByTemplateId(userKey, 'system:heart').map((row) => row.id)).toEqual(['sim-heart'])
    expect(listConsultationsByTemplateId(userKey, '15', '42').map((row) => row.id)).toEqual(['sim-customer'])
    expect(listConsultationsByCustomerId(userKey, '42').map((row) => row.id)).toEqual(['sim-customer'])
    expect(listConsultationsByCustomerId(userKey, '99').map((row) => row.id)).toEqual(['sim-other-customer'])
  })

  it('forks a system template on edit and does not upload the system id', async () => {
    const system = buildSystemTemplateSnapshot('cancer')
    expect(system).not.toBeNull()
    const edited: ScenarioTemplate = {
      ...system!,
      items: system!.items.map((item, index) =>
        index === 0 && item.type === 'coverage' ? { ...item, proposedAmount: 1 } : item,
      ),
    }
    const saved = await persistScenarioTemplate(userKey, edited)
    expect(saved.id).toBe('99')
    expect(saved.legacyClientId).not.toMatch(/^system:/)
    expect(saved.sourceType).toBe('user')
    expect(listScenarioTemplates(userKey).some((row) => row.id === 'system:cancer')).toBe(true)
    await removeScenarioTemplate(userKey, 'system:cancer')
    expect(deletedTemplateIds).toEqual([])
  })
})
