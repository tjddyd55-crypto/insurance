import { toJpeg } from 'html-to-image'
import { jsPDF } from 'jspdf'

const EXPORT_PIXEL_RATIO = 2
const RESULT_FORM_WIDTH = 794
const A4_RATIO = 1.4142
const HORIZONTAL_MARGIN_CM = 1.5
const CM_TO_PX = 96 / 2.54

function createSafeFileName(input: string): string {
  return input
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80)
}

async function waitForStableRender(): Promise<void> {
  if ('fonts' in document) {
    await document.fonts.ready
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

async function renderResultAsJpegDataUrl(targetElement: HTMLElement): Promise<string> {
  await waitForStableRender()

  const width = RESULT_FORM_WIDTH
  const height = Math.max(Math.round(RESULT_FORM_WIDTH * A4_RATIO), targetElement.scrollHeight)
  const horizontalMarginPx = Math.round(HORIZONTAL_MARGIN_CM * CM_TO_PX * EXPORT_PIXEL_RATIO)

  const rawDataUrl = await toJpeg(targetElement, {
    pixelRatio: EXPORT_PIXEL_RATIO,
    canvasWidth: width * EXPORT_PIXEL_RATIO,
    canvasHeight: height * EXPORT_PIXEL_RATIO,
    width,
    height,
    quality: 0.98,
    backgroundColor: '#ffffff',
  })

  const image = new Image()
  image.src = rawDataUrl
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('이미지 렌더링에 실패했습니다.'))
  })

  const canvas = document.createElement('canvas')
  canvas.width = image.width + horizontalMarginPx * 2
  canvas.height = image.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('이미지 캔버스를 생성할 수 없습니다.')
  }

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, horizontalMarginPx, 0)

  return canvas.toDataURL('image/jpeg', 0.98)
}

export async function createResultJpgFile(
  targetElement: HTMLElement,
  title: string,
): Promise<File> {
  const dataUrl = await renderResultAsJpegDataUrl(targetElement)
  const blob = await (await fetch(dataUrl)).blob()

  return new File([blob], `${createSafeFileName(title)}.jpg`, {
    type: 'image/jpeg',
  })
}

export async function exportResultToJpg(
  targetElement: HTMLElement,
  title: string,
): Promise<void> {
  const dataUrl = await renderResultAsJpegDataUrl(targetElement)

  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `${createSafeFileName(title)}.jpg`
  link.click()
}

export async function exportResultToPdf(
  targetElement: HTMLElement,
  title: string,
): Promise<void> {
  const dataUrl = await renderResultAsJpegDataUrl(targetElement)

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: 'a4',
  })
  const image = new Image()
  image.src = dataUrl

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('이미지 로딩에 실패했습니다.'))
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const horizontalMargin = pageWidth * (HORIZONTAL_MARGIN_CM / 21)
  const availableWidth = Math.max(pageWidth - horizontalMargin * 2, 1)
  const ratio = Math.min(availableWidth / image.width, pageHeight / image.height)
  const renderWidth = image.width * ratio
  const renderHeight = image.height * ratio
  const x = horizontalMargin
  const y = (pageHeight - renderHeight) / 2

  pdf.addImage(dataUrl, 'JPEG', x, y, renderWidth, renderHeight)
  pdf.save(`${createSafeFileName(title)}.pdf`)
}
