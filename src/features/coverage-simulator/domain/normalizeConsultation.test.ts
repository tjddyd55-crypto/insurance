import { describe, expect, it } from 'vitest'

import { createScenarioFromTemplate } from './templates'
import { normalizeConsultation } from './normalizeConsultation'

describe('normalizeConsultation', () => {
  it('reindexes malformed item order on load', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    const shuffled = scenario.items.map((item, index) => ({
      ...item,
      order: index === 0 ? 99 : index === 1 ? 0 : item.order,
    }))
    const idsBefore = shuffled.map((item) => item.id)
    const normalized = normalizeConsultation({ ...scenario, items: shuffled })
    expect(normalized.items.map((item) => item.order)).toEqual(shuffled.map((_, index) => index))
    expect(normalized.items.map((item) => item.id)).toEqual(idsBefore)
  })
})
