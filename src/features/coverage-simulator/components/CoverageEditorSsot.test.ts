import { describe, expect, it } from 'vitest'

import { resolveCoverageEditorVariant } from './CoverageEditorSsot'

describe('CoverageEditorSsot', () => {
  it('uses the same variant rule as standalone ScenarioEditorPage', () => {
    expect(resolveCoverageEditorVariant('preview-pc')).toBe('pc')
    expect(resolveCoverageEditorVariant('crm')).toBe('mobile')
    expect(resolveCoverageEditorVariant('preview-mobile')).toBe('mobile')
  })
})
