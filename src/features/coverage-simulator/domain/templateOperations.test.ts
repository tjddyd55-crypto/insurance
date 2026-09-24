import { describe, expect, it } from 'vitest'

import { createCancerDefaultItems } from './templates'
import {
  cloneScenarioItems,
  cloneUserTemplate,
  createConsultationFromTemplate,
  createEmptyUserTemplate,
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
    expect(copy.items).toHaveLength(source.items.length)
    expect(copy.items[0].id).not.toBe(source.items[0].id)
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
