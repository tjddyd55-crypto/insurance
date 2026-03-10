import { toJpeg } from 'html-to-image'
import { jsPDF } from 'jspdf'

const EXPORT_PIXEL_RATIO = 2
const A4_JPEG_WIDTH = 2480
const A4_JPEG_HEIGHT = 3508

function createSafeFileName(input: string): string {
  return input
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80)
}

export async function exportResultToJpg(
  targetElement: HTMLElement,
  title: string,
): Promise<void> {
  const width = targetElement.scrollWidth
  const height = targetElement.scrollHeight

  const dataUrl = await toJpeg(targetElement, {
    pixelRatio: EXPORT_PIXEL_RATIO,
    canvasWidth: Math.max(A4_JPEG_WIDTH, width * EXPORT_PIXEL_RATIO),
    canvasHeight: Math.max(A4_JPEG_HEIGHT, height * EXPORT_PIXEL_RATIO),
    quality: 0.98,
    backgroundColor: '#ffffff',
  })

  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `${createSafeFileName(title)}.jpg`
  link.click()
}

export async function exportResultToPdf(
  targetElement: HTMLElement,
  title: string,
): Promise<void> {
  const width = targetElement.scrollWidth
  const height = targetElement.scrollHeight

  const dataUrl = await toJpeg(targetElement, {
    pixelRatio: EXPORT_PIXEL_RATIO,
    canvasWidth: Math.max(A4_JPEG_WIDTH, width * EXPORT_PIXEL_RATIO),
    canvasHeight: Math.max(A4_JPEG_HEIGHT, height * EXPORT_PIXEL_RATIO),
    quality: 0.98,
    backgroundColor: '#ffffff',
  })

  const pdf = new jsPDF('p', 'mm', 'a4')
  const image = new Image()
  image.src = dataUrl

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('이미지 로딩에 실패했습니다.'))
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  pdf.addImage(dataUrl, 'JPEG', 0, 0, pageWidth, pageHeight)
  pdf.save(`${createSafeFileName(title)}.pdf`)
}
