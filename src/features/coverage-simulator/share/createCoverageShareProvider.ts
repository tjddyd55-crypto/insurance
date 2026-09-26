import type { CoverageShareProviderMode } from './coverageShareProviderMode'
import type { CoverageShareProvider } from './CoverageShareProvider'
import { CrmCoverageShareProvider } from './CrmCoverageShareProvider'
import { PreviewCoverageShareProvider } from './PreviewCoverageShareProvider'

export function createCoverageShareProvider(
  mode: CoverageShareProviderMode,
  token: string | null,
): CoverageShareProvider | null {
  if (mode === 'preview-dev') {
    return new PreviewCoverageShareProvider()
  }
  return token ? new CrmCoverageShareProvider(token) : null
}
