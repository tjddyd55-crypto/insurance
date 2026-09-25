import { apiRequest, resolveAbsoluteApiUrl, resolveApiUrl } from '../../../lib/apiClient'
import type { CoverageScenario } from '../domain/types'

export type CreateCoverageShareResponse = {
  shareId: string
  shareUrl: string
  createdAt: string
  expiresAt: string | null
  pdfReady: boolean
}

export type CoverageShareListItem = {
  shareId: string
  title: string
  createdAt: string
  revokedAt: string | null
  lastViewedAt: string | null
  viewCount: number
  pdfReady: boolean
  shareUrl: string | null
}

export type PublicCoverageSharePayload = {
  title: string
  customerName: string | null
  sharedAt: string
  scenario: CoverageScenario
  pdfReady: boolean
}

export async function createCoverageSimulationShare(
  token: string,
  consultationId: string,
  scenario: CoverageScenario,
): Promise<CreateCoverageShareResponse> {
  return apiRequest<CreateCoverageShareResponse>(
    `/api/coverage-simulator/consultations/${encodeURIComponent(consultationId)}/shares`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({ scenario }),
    },
  )
}

export async function listCoverageSimulationShares(
  token: string,
  consultationId: string,
): Promise<{ shares: CoverageShareListItem[] }> {
  return apiRequest<{ shares: CoverageShareListItem[] }>(
    `/api/coverage-simulator/consultations/${encodeURIComponent(consultationId)}/shares`,
    { token },
  )
}

export async function revokeCoverageSimulationShare(token: string, shareId: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/coverage-simulator/shares/${encodeURIComponent(shareId)}/revoke`, {
    method: 'POST',
    token,
  })
}

export async function uploadCoverageSharePdf(token: string, shareId: string, pdfBlob: Blob): Promise<void> {
  await apiRequest<{ ok: boolean; pdfReady: boolean }>(
    `/api/coverage-simulator/shares/${encodeURIComponent(shareId)}/pdf`,
    {
      method: 'PUT',
      token,
      body: pdfBlob,
      headers: { 'Content-Type': 'application/pdf' },
    },
  )
}

export async function createCoveragePdfArtifact(
  token: string,
  pdfBlob: Blob,
  fileName: string,
): Promise<{ downloadUrl: string; fileName: string }> {
  return apiRequest<{ downloadUrl: string; fileName: string }>(
    '/api/coverage-simulator/pdf-artifacts',
    {
      method: 'POST',
      token,
      body: pdfBlob,
      headers: {
        'Content-Type': 'application/pdf',
        'X-Coverage-Pdf-Filename': encodeURIComponent(fileName),
      },
    },
  )
}

export async function fetchPublicCoverageShare(token: string): Promise<PublicCoverageSharePayload> {
  return apiRequest<PublicCoverageSharePayload>(
    `/api/public/coverage-shares/${encodeURIComponent(token)}`,
  )
}

export function publicCoverageSharePdfDownloadUrl(shareToken: string): string {
  return resolveAbsoluteApiUrl(`/api/public/coverage-shares/${encodeURIComponent(shareToken)}/pdf`)
}

export async function downloadPublicCoverageSharePdf(shareToken: string, fileName: string): Promise<void> {
  const url = resolveApiUrl(`/api/public/coverage-shares/${encodeURIComponent(shareToken)}/pdf`)
  const response = await fetch(url)
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string }
    throw new Error(payload.message ?? 'PDF를 다운로드하지 못했습니다.')
  }
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}
