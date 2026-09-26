import { describe, expect, it } from 'vitest'

import { createScenarioFromTemplate } from '../domain/templates'
import { buildCoveragePdfFileName } from './coveragePdfFileName'

describe('buildCoveragePdfFileName', () => {
  it('includes customer, disease, and date', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    scenario.customerNameSnapshot = '김민수'
    scenario.consultationDate = '2026-09-25'
    expect(buildCoveragePdfFileName(scenario)).toBe('김민수_암치료_보장시뮬레이션_2026-09-25.pdf')
  })

  it('omits customer when absent', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    scenario.customerNameSnapshot = null
    scenario.consultationDate = '2026-09-25'
    expect(buildCoveragePdfFileName(scenario)).toMatch(/^암치료_보장시뮬레이션_2026-09-25\.pdf$/)
  })
})
