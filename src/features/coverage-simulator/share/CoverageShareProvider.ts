import type {
  CoverageShareListItem,
  CreateCoverageShareResponse,
} from '../api/coverageSimulatorShareApi'
import type { CoverageScenario } from '../domain/types'

export interface CoverageShareProvider {
  readonly mode: 'crm' | 'preview-dev'
  ensureAccess(): Promise<boolean>
  createShare(scenario: CoverageScenario): Promise<CreateCoverageShareResponse>
  listShares(consultationId: string): Promise<{ shares: CoverageShareListItem[] }>
  revokeShare(shareId: string): Promise<void>
  uploadSharePdf(shareId: string, pdfBlob: Blob): Promise<void>
  createPdfArtifact(pdfBlob: Blob, fileName: string): Promise<{ downloadUrl: string; fileName: string }>
}
