import { toJpeg } from 'html-to-image'
import { jsPDF } from 'jspdf'

const EXPORT_PIXEL_RATIO = 2
const RESULT_FORM_WIDTH = 794
const A4_RATIO = 1.4142

function createSafeFileName(input: string): string {
  return input
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80)
}

async function renderResultAsJpegDataUrl(targetElement: HTMLElement): Promise<string> {
  const width = RESULT_FORM_WIDTH
  const height = Math.max(Math.round(RESULT_FORM_WIDTH * A4_RATIO), targetElement.scrollHeight)

  return toJpeg(targetElement, {
    pixelRatio: EXPORT_PIXEL_RATIO,
    canvasWidth: width * EXPORT_PIXEL_RATIO,
    canvasHeight: height * EXPORT_PIXEL_RATIO,
    width,
    height,
    quality: 0.98,
    backgroundColor: '#ffffff',
  })
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
  const ratio = Math.min(pageWidth / image.width, pageHeight / image.height)
  const renderWidth = image.width * ratio
  const renderHeight = image.height * ratio
  const x = (pageWidth - renderWidth) / 2
  const y = (pageHeight - renderHeight) / 2

  pdf.addImage(dataUrl, 'JPEG', x, y, renderWidth, renderHeight)
  pdf.save(`${createSafeFileName(title)}.pdf`)
}
