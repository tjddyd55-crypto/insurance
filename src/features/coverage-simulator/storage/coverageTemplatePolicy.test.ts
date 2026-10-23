import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CoverageScenario } from '../domain/types'
import type { ScenarioTemplate } from '../domain/templateTypes'
import { buildSeedScenarioTemplate } from '../domain/scenarioSeed'
import {
  getConsultationById,
  listConsultations,
  listConsultationsByCustomerId,
  saveConsultationAsync,
} from './consultationRepository'
import { importLegacyLocalTemplates } from './importLegacyLocalTemplates'
import { templateStorageKey } from './previewStorageKeys'
import {
  listScenarioTemplates,
  persistScenarioTemplate,
  removeScenarioTemplate,
} from './templateRepository'

const userKey = 'crm-user'

const crm = vi.hoisted(() => ({
  templates: [] as ScenarioTemplate[],
  consultations: [] as CoverageScenario[],
}))

const createCoverageTemplateApi = vi.hoisted(() => vi.fn())

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
      seedKey: undefined,
    }
    crm.templates.unshift(saved)
    return saved
  },
  deleteCrmUserTemplate: async (id: string) => {
    crm.templates = crm.templates.filter((row) => row.id !== id)
  },
  duplicateCrmUserTemplate: async (id: string) => {
    const found = crm.templates.find((row) => row.id === id)
    if (!found) throw new Error('missing')
    return found
  },
  saveCrmConsultation: async (scenario: CoverageScenario) => {
    const index = crm.consultations.findIndex((row) => row.id === scenario.id)
    if (index >= 0) crm.consultations[index] = scenario
    else crm.consultations.unshift(scenario)
    return scenario
  },
  deleteCrmConsultation: async () => {},
}))

vi.mock('./coverageSimulatorStorage.api', () => ({
  createCoverageTemplateApi: (...args: unknown[]) => createCoverageTemplateApi(...args),
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

function userTemplate(partial: Partial<ScenarioTemplate> & Pick<ScenarioTemplate, 'id' | 'name'>): ScenarioTemplate {
  return {
    sourceType: 'user',
    items: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...partial,
  }
}

function simulation(partial: Partial<CoverageScenario> & Pick<CoverageScenario, 'id'>): CoverageScenario {
  return {
    title: '시뮬레이션',
    diseaseType: 'cancer',
    description: '',
    consultationDate: '2026-10-01',
    items: [
      {
        id: 'item-1',
        type: 'coverage',
        category: 'treatment',
        label: '수술비',
        currentAmount: 100,
        proposedAmount: 200,
        order: 0,
      },
    ],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    customerId: null,
    templateId: partial.templateId,
    ...partial,
  }
}

describe('coverage template policy', () => {
  beforeEach(() => {
    crm.templates = []
    crm.consultations = []
    createCoverageTemplateApi.mockReset()
    createCoverageTemplateApi.mockImplementation(async (_token: string, body: { name: string; legacyClientId?: string }) => ({
      id: String(createCoverageTemplateApi.mock.calls.length + 10),
      legacyClientId: body.legacyClientId ?? null,
      name: body.name,
      sourceType: 'user',
      diseaseType: 'custom',
      items: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }))
    stubLocalStorage()
  })

  it('lists only the current user server templates', () => {
    crm.templates = [
      userTemplate({ id: '16', name: '내 시나리오' }),
      userTemplate({ id: 'system:cancer', name: '암 치료', sourceType: 'system' }),
      userTemplate({ id: '15', name: '암 치료 사본', seedKey: 'seed:cancer', systemDiseaseType: 'cancer' }),
    ]
    expect(listScenarioTemplates(userKey).map((row) => row.id)).toEqual(['16'])
  })

  it('keeps a simulation whose template is missing on the list, in detail, and in edit', async () => {
    crm.templates = [userTemplate({ id: '16', name: '내 시나리오' })]
    crm.consultations = [
      simulation({ id: 'sim-direct', templateId: undefined, customerId: '7' }),
      simulation({
        id: 'sim-missing',
        templateId: 'deleted-template',
        templateNameSnapshot: '암 치료',
        customerId: '42',
      }),
    ]

    const rows = listConsultations(userKey)
    expect(rows.map((row) => row.id)).toEqual(expect.arrayContaining(['sim-direct', 'sim-missing']))
    const templateIds = new Set(listScenarioTemplates(userKey).map((row) => row.id))
    expect(rows.filter((row) => row.templateId && templateIds.has(row.templateId)).map((row) => row.id)).not.toContain(
      'sim-missing',
    )

    const detail = getConsultationById(userKey, 'sim-missing')
    expect(detail?.items[0]).toMatchObject({ label: '수술비', proposedAmount: 200 })
    expect(detail?.templateId).toBe('deleted-template')

    const edited = await saveConsultationAsync(userKey, {
      ...detail!,
      title: '수정된 시뮬레이션',
      items: detail!.items.map((item) =>
        item.type === 'coverage' ? { ...item, proposedAmount: 300 } : item,
      ),
    })
    expect(edited.title).toBe('수정된 시뮬레이션')
    expect(getConsultationById(userKey, 'sim-missing')?.title).toBe('수정된 시뮬레이션')
    expect(getConsultationById(userKey, 'sim-missing')?.items[0]).toMatchObject({ proposedAmount: 300 })
  })

  it('keeps simulations after the user template is deleted', async () => {
    crm.templates = [userTemplate({ id: '16', name: '내 시나리오' })]
    crm.consultations = [simulation({ id: 'sim-from-16', templateId: '16', customerId: '42' })]

    await removeScenarioTemplate(userKey, '16')

    expect(listScenarioTemplates(userKey)).toEqual([])
    expect(listConsultations(userKey).map((row) => row.id)).toEqual(['sim-from-16'])
    expect(getConsultationById(userKey, 'sim-from-16')?.templateId).toBe('16')
  })

  it('isolates simulations by customer id', () => {
    crm.consultations = [
      simulation({ id: 'sim-customer', templateId: 'missing', customerId: '42' }),
      simulation({ id: 'sim-other', templateId: 'missing', customerId: '99' }),
      simulation({ id: 'sim-none', templateId: undefined, customerId: null }),
    ]
    expect(listConsultationsByCustomerId(userKey, '42').map((row) => row.id)).toEqual(['sim-customer'])
    expect(listConsultationsByCustomerId(userKey, '7')).toEqual([])
  })

  it('migrates a local user template once and never migrates system defaults', async () => {
    const seed = buildSeedScenarioTemplate('heart')
    const key = templateStorageKey(userKey)!
    localStorage.setItem(
      key,
      JSON.stringify([
        userTemplate({ id: 'user-local', name: '내가 만든 템플릿' }),
        seed,
        userTemplate({ id: 'system:cancer', name: '암 치료', sourceType: 'system' }),
      ]),
    )

    const existing = new Set<string>()
    await importLegacyLocalTemplates('token', userKey, existing)
    await importLegacyLocalTemplates('token', userKey, existing)
    await importLegacyLocalTemplates('token', userKey, new Set(existing))

    expect(createCoverageTemplateApi).toHaveBeenCalledTimes(1)
    expect(createCoverageTemplateApi.mock.calls[0]?.[1]).toMatchObject({
      name: '내가 만든 템플릿',
      legacyClientId: 'user-local',
    })
  })

  it('does not persist a system catalog id as a user template', async () => {
    await persistScenarioTemplate(
      userKey,
      userTemplate({ id: 'system:cancer', name: '암 치료', sourceType: 'system' }),
    )
    expect(crm.templates).toEqual([])
    expect(listScenarioTemplates(userKey)).toEqual([])
  })
})
