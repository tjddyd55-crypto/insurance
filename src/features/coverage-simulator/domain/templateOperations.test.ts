import { afterEach, describe, expect, it, vi } from 'vitest'

import { createCancerDefaultItems, createScenarioFromTemplate } from './templates'
import {
  cloneScenarioItems,
  cloneUserTemplate,
  createConsultationFromTemplate,
  createEmptyUserTemplate,
  templateToEditableScenario,
} from './templateOperations'
import type { ScenarioTemplate } from './templateTypes'

function sampleUserTemplate(): ScenarioTemplate {
  return {
    id: 'tpl-1',
    name: '용종 제거 플랜',
    sourceType: 'user',
    items: createCancerDefaultItems().slice(0, 3),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('templateOperations', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('createEmptyUserTemplate', () => {
    const template = createEmptyUserTemplate('용종 제거 플랜', '설명')
    expect(template.name).toBe('용종 제거 플랜')
    expect(template.sourceType).toBe('user')
    expect(template.items).toHaveLength(0)
  })

  it('cloneUserTemplate creates new id and deep-copied items', () => {
    const source = sampleUserTemplate()
    const copy = cloneUserTemplate(source, { name: '복사본' })
    expect(copy.id).not.toBe(source.id)
    expect(copy.name).toBe('복사본')
    expect(cloneUserTemplate(source).name).toBe('용종 제거 플랜 복사본')
    expect(copy.items).toHaveLength(source.items.length)
    expect(copy.items[0].id).not.toBe(source.items[0].id)
  })

  it('createConsultationFromTemplate attaches optional customer', () => {
    const template = sampleUserTemplate()
    const consultation = createConsultationFromTemplate(template, {
      customer: { customerId: 'c-1', customerNameSnapshot: '김민수' },
    })
    expect(consultation.customerId).toBe('c-1')
    expect(consultation.customerNameSnapshot).toBe('김민수')
    expect(consultation.templateId).toBe(template.id)
  })

  it('stores the Seoul calendar day when the UTC date is still yesterday', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-30T16:30:00Z'))
    const consultation = createConsultationFromTemplate(sampleUserTemplate())
    expect(consultation.consultationDate).toBe('2026-10-01')
    expect(createScenarioFromTemplate('cancer')?.consultationDate).toBe('2026-10-01')
  })

  it('templateToEditableScenario uses the Seoul day of updatedAt', () => {
    const scenario = templateToEditableScenario({
      ...sampleUserTemplate(),
      updatedAt: '2026-09-30T16:30:00Z',
    })
    expect(scenario.consultationDate).toBe('2026-10-01')
  })

  it('createConsultationFromTemplate leaves customer null when omitted', () => {
    const consultation = createConsultationFromTemplate(sampleUserTemplate())
    expect(consultation.customerId).toBeNull()
    expect(consultation.customerNameSnapshot).toBeNull()
  })

  it('createConsultationFromTemplate clones items and keeps template reference', () => {
    const template = sampleUserTemplate()
    const consultation = createConsultationFromTemplate(template)
    expect(consultation.id).not.toBe(template.id)
    expect(consultation.templateId).toBe(template.id)
    expect(consultation.templateNameSnapshot).toBe(template.name)
    expect(consultation.items[0].id).not.toBe(template.items[0].id)
    expect(consultation.items[0].currentAmount).toBe(template.items[0].currentAmount)
  })

  it('template update does not mutate consultation copy', () => {
    const template = sampleUserTemplate()
    const consultation = createConsultationFromTemplate(template)
    const updatedTemplate: ScenarioTemplate = {
      ...template,
      items: cloneScenarioItems(template.items),
    }
    if (updatedTemplate.items[0].type === 'coverage') {
      updatedTemplate.items[0].proposedAmount = 99_999_999
    }
    expect(consultation.items[0].type === 'coverage' && consultation.items[0].proposedAmount).not.toBe(99_999_999)
  })

  it('cloneScenarioItems assigns fresh ids', () => {
    const items = createCancerDefaultItems().slice(0, 2)
    const cloned = cloneScenarioItems(items)
    expect(cloned.map((i) => i.id)).not.toEqual(items.map((i) => i.id))
  })
})
