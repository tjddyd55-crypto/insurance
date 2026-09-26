import type { CoverageSimulatorLayoutMode } from '../CoverageSimulatorScope'

export type CoverageShareProviderMode = 'crm' | 'preview-dev'

/** Production 빌드에서는 VITE_ENABLE_COVERAGE_PREVIEW_SHARE=true 일 때만 Preview Share API 허용 */
export function isPreviewShareClientEnabled(): boolean {
  if (!import.meta.env.PROD) return true
  return import.meta.env.VITE_ENABLE_COVERAGE_PREVIEW_SHARE === 'true'
}

export function resolveCoverageShareProviderMode(layoutMode: CoverageSimulatorLayoutMode): CoverageShareProviderMode {
  if (layoutMode === 'crm') return 'crm'
  if (isPreviewShareClientEnabled()) return 'preview-dev'
  return 'crm'
}

export function canShowCoverageShareButton(input: {
  isTemplate: boolean
  hasScenario: boolean
}): boolean {
  return !input.isTemplate && input.hasScenario
}
