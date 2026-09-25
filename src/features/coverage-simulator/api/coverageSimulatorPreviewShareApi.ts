import { apiRequest } from '../../../lib/apiClient'
import type { CoverageScenario } from '../domain/types'
import type { CreateCoverageShareResponse, CoverageShareListItem } from './coverageSimulatorShareApi'

export async function createPreviewCoverageSimulationShare(
  consultationId: string,
  scenario: CoverageScenario,
): Promise<CreateCoverageShareResponse> {
  return apiRequest<CreateCoverageShareResponse>(
    `/api/dev/coverage-simulator/preview-shares/${encodeURIComponent(consultationId)}`,
    {
      method: 'POST',
      body: JSON.stringify({ scenario }),
    },
  )
}

export async function listPreviewCoverageSimulationShares(
  consultationId: string,
): Promise<{ shares: CoverageShareListItem[] }> {
  return apiRequest<{ shares: CoverageShareListItem[] }>(
    `/api/dev/coverage-simulator/preview-shares/${encodeURIComponent(consultationId)}`,
  )
}

export async function revokePreviewCoverageSimulationShare(shareId: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/dev/coverage-simulator/preview-shares/${encodeURIComponent(shareId)}/revoke`, {
    method: 'POST',
  })
}

export async function uploadPreviewCoverageSharePdf(shareId: string, pdfBlob: Blob): Promise<void> {
  await apiRequest<{ ok: boolean; pdfReady: boolean }>(
    `/api/dev/coverage-simulator/preview-shares/${encodeURIComponent(shareId)}/pdf`,
    {
      method: 'PUT',
      body: pdfBlob,
      headers: { 'Content-Type': 'application/pdf' },
    },
  )
}

export async function createPreviewCoveragePdfArtifact(
  pdfBlob: Blob,
  fileName: string,
): Promise<{ downloadUrl: string; fileName: string }> {
  return apiRequest<{ downloadUrl: string; fileName: string }>(
    '/api/dev/coverage-simulator/pdf-artifacts',
    {
      method: 'POST',
      body: pdfBlob,
      headers: {
        'Content-Type': 'application/pdf',
        'X-Coverage-Pdf-Filename': encodeURIComponent(fileName),
      },
    },
  )
}
