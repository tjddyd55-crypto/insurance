import { isKakaoInAppBrowser } from '../lib/userAgentHints'
import { buildCoveragePdfBlobFromPrintRoot } from './generateCoveragePdf'

const PDF_MIME = 'application/pdf'

export function ensureApplicationPdfBlob(blob: Blob): Blob {
  if (blob.type === PDF_MIME) return blob
  return new Blob([blob], { type: PDF_MIME })
}

export function sanitizePdfFileName(fileName: string): string {
  const trimmed = String(fileName ?? '').trim() || '보장시뮬레이션.pdf'
  const safe = trimmed.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`
}

function assertPdfBlob(blob: Blob): Blob {
  const pdfBlob = ensureApplicationPdfBlob(blob)
  if (pdfBlob.type !== PDF_MIME) {
    throw new Error('PDF MIME invalid')
  }
  if (pdfBlob.size === 0) {
    throw new Error('PDF empty')
  }
  return pdfBlob
}

function triggerAnchorDownload(href: string, fileName: string): void {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = sanitizePdfFileName(fileName)
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

async function blobToDataUri(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${PDF_MIME};base64,${btoa(binary)}`
}

export async function downloadPdfBlob(blob: Blob, fileName: string): Promise<void> {
  const pdfBlob = assertPdfBlob(blob)
  const safeName = sanitizePdfFileName(fileName)

  const tryObjectUrl = () => {
    const url = URL.createObjectURL(pdfBlob)
    try {
      triggerAnchorDownload(url, safeName)
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 4000)
    }
  }

  if (isKakaoInAppBrowser()) {
    const dataUri = await blobToDataUri(pdfBlob)
    triggerAnchorDownload(dataUri, safeName)
    return
  }

  try {
    tryObjectUrl()
  } catch {
    const dataUri = await blobToDataUri(pdfBlob)
    triggerAnchorDownload(dataUri, safeName)
  }
}

export async function downloadCoveragePdfFromPrintRoot(root: HTMLElement, fileName: string): Promise<void> {
  const blob = await buildCoveragePdfBlobFromPrintRoot(root)
  await downloadPdfBlob(blob, fileName)
}
