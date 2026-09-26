import {
  createPreviewCoveragePdfArtifact,
  createPreviewCoverageSimulationShare,
  listPreviewCoverageSimulationShares,
  revokePreviewCoverageSimulationShare,
  uploadPreviewCoverageSharePdf,
} from '../api/coverageSimulatorPreviewShareApi'
import type { CoverageScenario } from '../domain/types'
import type { CoverageShareProvider } from './CoverageShareProvider'

/**
 * DEV Preview 전용 provider.
 * CRM auth/fetchMe/JWT 모듈을 import하지 않으므로 Preview 흐름에서 /api/me 호출이 불가능하다.
 */
export class PreviewCoverageShareProvider implements CoverageShareProvider {
  readonly mode = 'preview-dev' as const

  async ensureAccess(): Promise<boolean> {
    return true
  }

  createShare(scenario: CoverageScenario) {
    return createPreviewCoverageSimulationShare(scenario.id, scenario)
  }

  listShares(consultationId: string) {
    return listPreviewCoverageSimulationShares(consultationId)
  }

  revokeShare(shareId: string) {
    return revokePreviewCoverageSimulationShare(shareId)
  }

  uploadSharePdf(shareId: string, pdfBlob: Blob) {
    return uploadPreviewCoverageSharePdf(shareId, pdfBlob)
  }

  createPdfArtifact(pdfBlob: Blob, fileName: string) {
    return createPreviewCoveragePdfArtifact(pdfBlob, fileName)
  }
}
