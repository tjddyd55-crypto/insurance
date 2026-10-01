import { describe, expect, it } from 'vitest'

import { createScenarioFromTemplate } from '../domain/templates'
import { buildCoveragePdfFileName } from './coveragePdfFileName'

describe('buildCoveragePdfFileName', () => {
  it('uses customer name and simulation title without a date', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    scenario.customerNameSnapshot = '김민수'
    scenario.title = '암 상담'
    scenario.consultationDate = '2026-09-25'
    expect(buildCoveragePdfFileName(scenario)).toBe('김민수_암 상담.pdf')
  })

  it('omits the customer when absent', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    scenario.customerNameSnapshot = null
    scenario.customerName = undefined
    scenario.title = '암 상담'
    expect(buildCoveragePdfFileName(scenario)).toBe('암 상담.pdf')
  })

  it('strips invalid characters, collapses spaces, and caps each part', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    scenario.customerNameSnapshot = '  김  민수 / '
    scenario.title = `A${'가'.repeat(50)}`
    const fileName = buildCoveragePdfFileName(scenario)
    expect(fileName.startsWith('김 민수_')).toBe(true)
    expect(fileName.endsWith('.pdf')).toBe(true)
    const simulation = fileName.slice('김 민수_'.length, -'.pdf'.length)
    expect(Array.from(simulation)).toHaveLength(40)
  })

  it('drops control characters from each part', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    scenario.customerNameSnapshot = '김\u0000민수'
    scenario.title = '암\u001F상담'
    expect(buildCoveragePdfFileName(scenario)).toBe('김민수_암상담.pdf')
  })

  it('falls back when customer and title are empty', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    scenario.customerNameSnapshot = null
    scenario.customerName = undefined
    scenario.title = ' /:*? '
    expect(buildCoveragePdfFileName(scenario)).toBe('보장시뮬레이션.pdf')
  })
})
