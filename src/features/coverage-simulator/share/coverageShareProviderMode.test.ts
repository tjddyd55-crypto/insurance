import { describe, expect, it } from 'vitest'

import { canShowCoverageShareButton, resolveCoverageShareProviderMode } from './coverageShareProviderMode'

describe('coverageShareProviderMode', () => {
  it('uses preview-dev provider for preview layout', () => {
    expect(resolveCoverageShareProviderMode('preview-mobile')).toBe('preview-dev')
    expect(resolveCoverageShareProviderMode('crm')).toBe('crm')
  })

  it('shows share button for saved consultation editors', () => {
    expect(canShowCoverageShareButton({ isTemplate: false, hasScenario: true })).toBe(true)
    expect(canShowCoverageShareButton({ isTemplate: true, hasScenario: true })).toBe(false)
  })
})
