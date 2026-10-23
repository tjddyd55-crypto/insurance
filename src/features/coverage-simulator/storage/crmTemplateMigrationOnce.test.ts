import { beforeEach, describe, expect, it, vi } from 'vitest'

import { hydrateCrmCoverageStorage, resetCrmCoverageStorageSession } from './crmCoverageStorageSession'
import { templateStorageKey } from './previewStorageKeys'

const createCoverageTemplateApi = vi.hoisted(() =>
  vi.fn(async (_token: string, body: { legacyClientId?: string; name?: string }) => ({
    id: '1',
    name: body.name ?? '',
    legacyClientId: body.legacyClientId ?? null,
  })),
)

vi.mock('./coverageSimulatorStorage.api', async () => {
  const actual = await vi.importActual<typeof import('./coverageSimulatorStorage.api')>(
    './coverageSimulatorStorage.api',
  )
  return {
    ...actual,
    fetchCoverageTemplates: vi.fn(async () => []),
    fetchCoverageSimulations: vi.fn(async () => []),
    createCoverageTemplateApi: (token: string, body: { legacyClientId?: string; name?: string }) =>
      createCoverageTemplateApi(token, body),
    createCoverageSimulationApi: vi.fn(async () => {
      throw new Error('simulation post')
    }),
  }
})

const userKey = 'migration-once-user'

function stubLocalStorage() {
  const memory = {
    store: {} as Record<string, string>,
    getItem(key: string) {
      return this.store[key] ?? null
    },
    setItem(key: string, value: string) {
      this.store[key] = value
    },
    removeItem(key: string) {
      delete this.store[key]
    },
    clear() {
      this.store = {}
    },
  }
  vi.stubGlobal('localStorage', memory)
}

describe('legacy template migration', () => {
  beforeEach(() => {
    createCoverageTemplateApi.mockClear()
    resetCrmCoverageStorageSession()
    stubLocalStorage()
    localStorage.setItem(
      templateStorageKey(userKey)!,
      JSON.stringify([
        {
          id: 'user-local',
          name: '내가 만든 템플릿',
          sourceType: 'user',
          items: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    )
  })

  it('posts each local user template once when hydrate overlaps', async () => {
    await Promise.all([
      hydrateCrmCoverageStorage(userKey, 'token'),
      hydrateCrmCoverageStorage(userKey, 'token'),
    ])
    expect(createCoverageTemplateApi).toHaveBeenCalledTimes(1)
    expect(createCoverageTemplateApi.mock.calls[0]?.[1]).toMatchObject({
      legacyClientId: 'user-local',
    })
  })
})
