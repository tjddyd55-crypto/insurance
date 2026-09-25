import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

import { COVERAGE_PDF_CAPTURE_WIDTH_PX, waitForCoveragePdfLayout } from './coveragePdfCapture'
import {
  applyCoveragePdfCaptureCloneFixes,
  assertCoveragePdfTitleTextSafety,
} from './coveragePdfTitleTextSafety'

async function printRootToJsPdf(root: HTMLElement): Promise<jsPDF> {
  await waitForCoveragePdfLayout(root)
  applyCoveragePdfCaptureCloneFixes(root)
  assertCoveragePdfTitleTextSafety(root)
  const captureWidth = root.offsetWidth > 0 ? root.offsetWidth : COVERAGE_PDF_CAPTURE_WIDTH_PX
  const captureHeight = root.scrollHeight > 0 ? root.scrollHeight : root.offsetHeight
  const canvas = await html2canvas(root, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    width: captureWidth,
    height: captureHeight,
    windowWidth: captureWidth,
    windowHeight: captureHeight,
    scrollX: 0,
    scrollY: 0,
    onclone: (_doc, clonedRoot) => {
      if (clonedRoot instanceof HTMLElement) {
        applyCoveragePdfCaptureCloneFixes(clonedRoot)
      }
    },
  })
  const imageData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imageWidth = pageWidth
  const imageHeight = (canvas.height * imageWidth) / canvas.width

  let heightLeft = imageHeight
  let position = 0

  pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight)
  heightLeft -= pageHeight

  while (heightLeft > 0) {
    position = heightLeft - imageHeight
    pdf.addPage()
    pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight)
    heightLeft -= pageHeight
  }

  return pdf
}

export async function buildCoveragePdfBlobFromPrintRoot(root: HTMLElement): Promise<Blob> {
  const pdf = await printRootToJsPdf(root)
  const blob = pdf.output('blob') as Blob
  if (blob.type === 'application/pdf') return blob
  return new Blob([blob], { type: 'application/pdf' })
}

export function printCoverageDocument(): void {
  window.print()
}
