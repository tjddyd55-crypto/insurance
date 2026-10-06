import { beforeEach, describe, expect, it, vi } from 'vitest'

import { COVERAGE_SIMULATOR_PREVIEW_PC_USER_KEY } from './scenarioRepository'
import { listConsultationsByCustomerId, saveConsultation } from './consultationRepository'

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

describe('listConsultationsByCustomerId', () => {
  const userKey = COVERAGE_SIMULATOR_PREVIEW_PC_USER_KEY

  beforeEach(() => {
    stubLocalStorage()
  })

  it('returns only simulations linked to the given customerId', () => {
    saveConsultation(userKey, {
      id: 'sim-a',
      kind: 'consultation',
      title: '암 치료',
      diseaseType: 'cancer',
      description: '',
      customerId: '42',
      customerNameSnapshot: '박성현',
      consultationDate: '2026-09-30',
      items: [],
      createdAt: '2026-09-30T00:00:00.000Z',
      updatedAt: '2026-09-30T00:00:00.000Z',
    })
    saveConsultation(userKey, {
      id: 'sim-b',
      kind: 'consultation',
      title: '암 치료',
      diseaseType: 'cancer',
      description: '',
      customerId: '99',
      customerNameSnapshot: '강은서',
      consultationDate: '2026-09-29',
      items: [],
      createdAt: '2026-09-29T00:00:00.000Z',
      updatedAt: '2026-09-29T00:00:00.000Z',
    })
    saveConsultation(userKey, {
      id: 'sim-c',
      kind: 'consultation',
      title: '미연결',
      diseaseType: 'cancer',
      description: '',
      customerId: null,
      consultationDate: '2026-09-28',
      items: [],
      createdAt: '2026-09-28T00:00:00.000Z',
      updatedAt: '2026-09-28T00:00:00.000Z',
    })

    const rows = listConsultationsByCustomerId(userKey, '42')
    expect(rows.map((row) => row.id)).toEqual(['sim-a'])
  })
})
