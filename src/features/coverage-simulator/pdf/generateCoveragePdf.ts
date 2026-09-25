import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

import { COVERAGE_PDF_CAPTURE_WIDTH_PX, waitForCoveragePdfLayout } from './coveragePdfCapture'
import {
  A4_PAGE_WIDTH_MM,
  calculateCoveragePdfPagePlan,
  type CoveragePdfPagePlan,
  type CoveragePdfPageSlice,
} from './coveragePdfPageSlices'
import {
  applyCoveragePdfCaptureCloneFixes,
  assertCoveragePdfTitleTextSafety,
  readCoveragePdfBadgeComputedStyle,
  readCoveragePdfTitleComputedStyle,
  type CoveragePdfBadgeComputedStyle,
  type CoveragePdfTitleComputedStyle,
} from './coveragePdfTitleTextSafety'

const SAFE_PAGE_BREAK_SELECTOR = [
  '.cs-axis-block',
  '.cs-period-boundary',
  '.cs-axis-summary',
  '.cs-print-disclaimer',
].join(',')

type CoveragePdfDiagnostics = {
  captureWidthPx: number
  captureHeightPx: number
  canvasWidthPx: number
  canvasHeightPx: number
  pdfPageWidthMm: number
  pdfPageHeightMm: number
  marginTopMm: number
  marginBottomMm: number
  usableHeightMm: number
  scaledImageHeightMm: number
  calculatedPageCount: number
  finalPdfPageCount: number
  renderScale: number
  title: CoveragePdfTitleComputedStyle | null
  badge: CoveragePdfBadgeComputedStyle | null
}

declare global {
  interface Window {
    __coveragePdfDebugCapture?: {
      pngDataUrl: string
      pdfDataUrl: string
      diagnostics: CoveragePdfDiagnostics
    }
  }
}

function collectSafeBreakpoints(root: HTMLElement, canvasScale: number): number[] {
  const rootRect = root.getBoundingClientRect()
  return Array.from(root.querySelectorAll<HTMLElement>(SAFE_PAGE_BREAK_SELECTOR))
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return (rect.bottom - rootRect.top) * canvasScale
    })
    .filter((point) => point > 0)
}

function findRepresentativeTitle(root: HTMLElement): HTMLElement | null {
  const labels = Array.from(
    root.querySelectorAll<HTMLElement>(
      '.cs-axis-event__title-axis .cs-axis-event__label',
    ),
  )
  return (
    labels.find((label) => label.textContent?.trim() === '항암약물치료') ??
    labels[0] ??
    null
  )
}

function createSliceCanvas(
  source: HTMLCanvasElement,
  slice: CoveragePdfPageSlice,
): HTMLCanvasElement {
  const output = document.createElement('canvas')
  output.width = source.width
  output.height = Math.ceil(slice.sourceHeight)
  const context = output.getContext('2d')
  if (!context) {
    throw new Error('PDF page canvas context를 생성하지 못했습니다.')
  }
  context.fillStyle = 'white'
  context.fillRect(0, 0, output.width, output.height)
  context.drawImage(
    source,
    0,
    slice.sourceY,
    source.width,
    slice.sourceHeight,
    0,
    0,
    output.width,
    output.height,
  )
  return output
}

function addCanvasPage(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  pageIndex: number,
  plan: CoveragePdfPagePlan,
): void {
  if (pageIndex > 0) {
    pdf.addPage()
  }

  const isOnePageFit = plan.pageCount === 1
  const imageWidth = A4_PAGE_WIDTH_MM * (isOnePageFit ? plan.renderScale : 1)
  const imageHeight = (canvas.height * imageWidth) / canvas.width
  const positionX = (A4_PAGE_WIDTH_MM - imageWidth) / 2
  pdf.addImage(
    canvas.toDataURL('image/png'),
    'PNG',
    positionX,
    0,
    imageWidth,
    imageHeight,
    undefined,
    'FAST',
  )
}

function publishDebugCapture(
  canvas: HTMLCanvasElement,
  pdf: jsPDF,
  diagnostics: CoveragePdfDiagnostics,
): void {
  console.info('[coverage-pdf-diagnostics]', JSON.stringify(diagnostics))
  if (new URLSearchParams(window.location.search).get('coveragePdfDebug') !== '1') {
    return
  }
  window.__coveragePdfDebugCapture = {
    pngDataUrl: canvas.toDataURL('image/png'),
    pdfDataUrl: pdf.output('datauristring'),
    diagnostics,
  }
}

async function printRootToJsPdf(root: HTMLElement): Promise<jsPDF> {
  await waitForCoveragePdfLayout(root)
  applyCoveragePdfCaptureCloneFixes(root)
  await waitForCoveragePdfLayout(root)
  assertCoveragePdfTitleTextSafety(root)
  const captureWidth = root.offsetWidth > 0 ? root.offsetWidth : COVERAGE_PDF_CAPTURE_WIDTH_PX
  const captureHeight = root.scrollHeight > 0 ? root.scrollHeight : root.offsetHeight
  const canvas = await html2canvas(root, {
    scale: 2,
    useCORS: true,
    backgroundColor: 'white',
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
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const canvasScale = canvas.height / captureHeight
  const pagePlan = calculateCoveragePdfPagePlan({
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    pdfPageWidthMm: pdf.internal.pageSize.getWidth(),
    pdfPageHeightMm: pdf.internal.pageSize.getHeight(),
    safeBreakpointsPx: collectSafeBreakpoints(root, canvasScale),
  })

  pagePlan.slices.forEach((slice, index) => {
    const pageCanvas =
      pagePlan.pageCount === 1 ? canvas : createSliceCanvas(canvas, slice)
    addCanvasPage(pdf, pageCanvas, index, pagePlan)
  })

  const representativeTitle = findRepresentativeTitle(root)
  const representativeBadge = root.querySelector<HTMLElement>(
    '.coverage-simulator-badge',
  )
  const diagnostics: CoveragePdfDiagnostics = {
    captureWidthPx: captureWidth,
    captureHeightPx: captureHeight,
    canvasWidthPx: canvas.width,
    canvasHeightPx: canvas.height,
    pdfPageWidthMm: pdf.internal.pageSize.getWidth(),
    pdfPageHeightMm: pdf.internal.pageSize.getHeight(),
    marginTopMm: 0,
    marginBottomMm: 0,
    usableHeightMm: pagePlan.usableHeightMm,
    scaledImageHeightMm: pagePlan.scaledImageHeightMm,
    calculatedPageCount: pagePlan.pageCount,
    finalPdfPageCount: pdf.getNumberOfPages(),
    renderScale: pagePlan.renderScale,
    title: representativeTitle
      ? readCoveragePdfTitleComputedStyle(representativeTitle)
      : null,
    badge: representativeBadge
      ? readCoveragePdfBadgeComputedStyle(representativeBadge)
      : null,
  }
  publishDebugCapture(canvas, pdf, diagnostics)

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
