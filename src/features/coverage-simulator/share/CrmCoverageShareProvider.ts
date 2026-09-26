import { fetchMe } from '../../auth/authApi'
import {
  createCoveragePdfArtifact,
  createCoverageSimulationShare,
  listCoverageSimulationShares,
  revokeCoverageSimulationShare,
  uploadCoverageSharePdf,
} from '../api/coverageSimulatorShareApi'
import type { CoverageScenario } from '../domain/types'
import type { CoverageShareProvider } from './CoverageShareProvider'

export class CrmCoverageShareProvider implements CoverageShareProvider {
  readonly mode = 'crm' as const

  constructor(private readonly token: string) {}

  async ensureAccess(): Promise<boolean> {
    if (!this.token) return false
    try {
      await fetchMe(this.token)
      return true
    } catch {
      return false
    }
  }

  createShare(scenario: CoverageScenario) {
    return createCoverageSimulationShare(this.token, scenario.id, scenario)
  }

  listShares(consultationId: string) {
    return listCoverageSimulationShares(this.token, consultationId)
  }

  revokeShare(shareId: string) {
    return revokeCoverageSimulationShare(this.token, shareId)
  }

  uploadSharePdf(shareId: string, pdfBlob: Blob) {
    return uploadCoverageSharePdf(this.token, shareId, pdfBlob)
  }

  createPdfArtifact(pdfBlob: Blob, fileName: string) {
    return createCoveragePdfArtifact(this.token, pdfBlob, fileName)
  }
}
