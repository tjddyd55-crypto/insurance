import { buildCoveragePdfBlobFromPrintRoot } from './generateCoveragePdf'

const PDF_MIME = 'application/pdf'

export function ensureApplicationPdfBlob(blob: Blob): Blob {
  if (blob.type === PDF_MIME) return blob
  return new Blob([blob], { type: PDF_MIME })
}

export function sanitizePdfFileName(fileName: string): string {
  const trimmed = String(fileName ?? '').trim() || '보장시뮬레이션.pdf'
  return trimmed.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
}

export function downloadPdfBlob(blob: Blob, fileName: string): void {
  const pdfBlob = ensureApplicationPdfBlob(blob)
  const url = URL.createObjectURL(pdfBlob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = sanitizePdfFileName(fileName)
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function downloadCoveragePdfFromPrintRoot(root: HTMLElement, fileName: string): Promise<void> {
  const blob = await buildCoveragePdfBlobFromPrintRoot(root)
  downloadPdfBlob(blob, fileName)
}
