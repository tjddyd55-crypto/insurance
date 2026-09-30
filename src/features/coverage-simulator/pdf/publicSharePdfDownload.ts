import { publicCoverageSharePdfDownloadUrl } from '../api/coverageSimulatorShareApi'
import { downloadCoveragePdfBlob } from './generateCoveragePdf'

export function isPdfBufferSignature(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 5) return false
  const head = new TextDecoder().decode(new Uint8Array(bytes.slice(0, 5)))
  return head.startsWith('%PDF-')
}

export async function fetchPublicCoverageSharePdfBlob(shareToken: string): Promise<Blob | null> {
  const url = publicCoverageSharePdfDownloadUrl(shareToken)
  const response = await fetch(url, { credentials: 'omit', cache: 'no-store' })
  if (!response.ok) return null

  const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
  if (contentType && !contentType.includes('application/pdf') && !contentType.includes('octet-stream')) {
    return null
  }

  const buffer = await response.arrayBuffer()
  if (!isPdfBufferSignature(buffer)) return null

  return new Blob([buffer], { type: 'application/pdf' })
}

export async function downloadPublicCoverageSharePdf(
  shareToken: string,
  fileName: string,
  options: {
    preferStored: boolean
    fallback: () => Promise<Blob | null>
  },
): Promise<'stored' | 'generated' | 'failed'> {
  if (options.preferStored) {
    try {
      const stored = await fetchPublicCoverageSharePdfBlob(shareToken)
      if (stored) {
        downloadCoveragePdfBlob(stored, fileName)
        return 'stored'
      }
    } catch (error) {
      console.warn('[coverage-share] stored PDF fetch failed', error)
    }
  }

  try {
    const generated = await options.fallback()
    if (!generated) return 'failed'
    downloadCoveragePdfBlob(generated, fileName)
    return 'generated'
  } catch (error) {
    console.error('[coverage-share] generated PDF fallback failed', error)
    return 'failed'
  }
}
