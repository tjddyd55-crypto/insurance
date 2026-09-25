import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createScenarioFromTemplate } from '../domain/templates'
import {
  deleteConsultation,
  getConsultationById,
  listConsultationsByDisease,
  renameConsultation,
  saveConsultation,
} from './consultationRepository'

describe('consultationRepository', () => {
  const userKey = '__test_consultation_repo__'
  const storageKey = `onefc:coverage-simulator:v1:${userKey}`

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
    localStorage.removeItem(storageKey)
  })

  it('preserves createdAt and updates updatedAt on save', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    scenario.title = '첫 저장'
    const first = saveConsultation(userKey, scenario)
    const createdAt = first.createdAt

    const second = saveConsultation(userKey, { ...first, title: '수정 저장' })
    expect(second.createdAt).toBe(createdAt)
    expect(second.updatedAt >= createdAt).toBe(true)
  })

  it('renames consultation and preserves createdAt', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    scenario.title = '암 치료'
    const saved = saveConsultation(userKey, scenario)
    const createdAt = saved.createdAt

    const renamed = renameConsultation(userKey, saved.id, '암 치료 1차 상담')
    expect(renamed?.title).toBe('암 치료 1차 상담')
    expect(renamed?.createdAt).toBe(createdAt)
    expect(renamed!.updatedAt >= createdAt).toBe(true)
    expect(getConsultationById(userKey, saved.id)?.title).toBe('암 치료 1차 상담')
  })

  it('rejects empty rename title', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    saveConsultation(userKey, scenario)
    expect(renameConsultation(userKey, scenario.id, '   ')).toBeNull()
  })

  it('deletes a single consultation', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    saveConsultation(userKey, scenario)
    deleteConsultation(userKey, scenario.id)
    expect(getConsultationById(userKey, scenario.id)).toBeNull()
  })

  it('lists consultations by disease type', () => {
    const cancer = createScenarioFromTemplate('cancer')!
    cancer.title = '암 A'
    saveConsultation(userKey, cancer)
    const rows = listConsultationsByDisease(userKey, 'cancer')
    expect(rows.some((row) => row.title === '암 A')).toBe(true)
    expect(getConsultationById(userKey, cancer.id)?.title).toBe('암 A')
  })
})
