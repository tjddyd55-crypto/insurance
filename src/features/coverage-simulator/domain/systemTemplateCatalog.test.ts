import { describe, expect, it } from 'vitest'

import { createConsultationFromTemplate } from './templateOperations'
import { buildSystemTemplateSnapshot, listSystemTemplateSummaries } from './systemTemplateCatalog'
import type { DiseaseType } from './types'

const SYSTEM_TYPES: DiseaseType[] = [
  'cancer',
  'cerebrovascular',
  'heart',
  'care-dementia',
  'fracture-surgery',
  'custom',
]

describe('systemTemplateCatalog', () => {
  it('lists all system scenarios as enabled with default items', () => {
    const summaries = listSystemTemplateSummaries()
    expect(summaries).toHaveLength(SYSTEM_TYPES.length)
    for (const row of summaries) {
      expect(row.enabled).toBe(true)
      expect(row.itemCount).toBeGreaterThan(0)
    }
  })

  it('buildSystemTemplateSnapshot is immutable when consultation is created', () => {
    for (const diseaseType of SYSTEM_TYPES) {
      const template = buildSystemTemplateSnapshot(diseaseType)
      expect(template?.sourceType).toBe('system')
      expect(template?.systemDiseaseType).toBe(diseaseType)
      const consultation = createConsultationFromTemplate(template!, { diseaseType })
      if (consultation.items[0]?.type === 'coverage') {
        consultation.items[0].proposedAmount = 1
      }
      const again = buildSystemTemplateSnapshot(diseaseType)
      expect(again?.items[0]).not.toEqual(consultation.items[0])
      if (again?.items[0]?.type === 'coverage') {
        expect(again.items[0].proposedAmount).not.toBe(1)
      }
    }
  })
})
