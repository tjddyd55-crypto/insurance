import { describe, expect, it } from 'vitest'
import { resolveCoverageEditorBackPath, resolveCoverageSimulationListPath } from './coverageSimulatorNavigation'

describe('coverageSimulatorNavigation', () => {
  const base = '/coverage-simulator'

  it('builds template simulation list path', () => {
    expect(resolveCoverageSimulationListPath(base, 'tpl-1')).toBe(
      '/coverage-simulator/templates/tpl-1/simulations',
    )
  })

  it('returns library for template editor', () => {
    expect(
      resolveCoverageEditorBackPath(base, { templateId: 'tpl-1', diseaseType: 'cancer' }, { isTemplateEditor: true }),
    ).toBe(base)
  })

  it('returns simulation list for consultation with templateId', () => {
    expect(resolveCoverageEditorBackPath(base, { templateId: 'tpl-1', diseaseType: 'cancer' })).toBe(
      '/coverage-simulator/templates/tpl-1/simulations',
    )
  })

  it('falls back to disease list for legacy consultations', () => {
    expect(resolveCoverageEditorBackPath(base, { diseaseType: 'cancer' })).toBe('/coverage-simulator/cancer')
  })
})
