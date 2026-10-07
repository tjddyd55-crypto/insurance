import sharp from 'sharp'
import { PDFDocument, rgb } from 'pdf-lib'

export const PDF_A4_WIDTH = 595.28
export const PDF_A4_HEIGHT = 841.89
export const RASTER_PDF_MARGIN = 36
export const RASTER_PDF_JPEG_QUALITY = 92

export function isRasterImageMime(mime) {
  return mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp'
}

export function getRasterPdfPageLayout(width, height) {
  if (!width || !height) return 'portrait'
  return height >= width ? 'portrait' : 'landscape'
}

export function getRasterPdfPageSize(width, height) {
  return getRasterPdfPageLayout(width, height) === 'portrait'
    ? [PDF_A4_WIDTH, PDF_A4_HEIGHT]
    : [PDF_A4_HEIGHT, PDF_A4_WIDTH]
}

/**
 * EXIF orientation을 반영하고 투명 배경을 흰색으로 합성한다.
 */
export async function normalizeRasterForPdf(bytes, mime) {
  if (!isRasterImageMime(mime)) {
    const error = new Error('지원하지 않는 이미지 형식입니다.')
    error.httpStatus = 400
    throw error
  }
  const pipeline = sharp(bytes).rotate().flatten({ background: '#ffffff' })
  const keepPng = mime === 'image/png'
  const output = keepPng
    ? await pipeline.png().toBuffer({ resolveWithObject: true })
    : await pipeline.jpeg({ quality: RASTER_PDF_JPEG_QUALITY }).toBuffer({ resolveWithObject: true })
  if (!output.info.width || !output.info.height) {
    const error = new Error('이미지 크기를 확인할 수 없습니다.')
    error.httpStatus = 422
    throw error
  }
  return {
    buffer: output.data,
    width: output.info.width,
    height: output.info.height,
    mime: keepPng ? 'image/png' : 'image/jpeg',
  }
}

export async function appendRasterImagePage(pdfDoc, bytes, mime) {
  const normalized = await normalizeRasterForPdf(bytes, mime)
  const image = normalized.mime === 'image/png'
    ? await pdfDoc.embedPng(normalized.buffer)
    : await pdfDoc.embedJpg(normalized.buffer)
  const [pageWidth, pageHeight] = getRasterPdfPageSize(normalized.width, normalized.height)
  const page = pdfDoc.addPage([pageWidth, pageHeight])
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: rgb(1, 1, 1),
  })
  const maxWidth = pageWidth - RASTER_PDF_MARGIN * 2
  const maxHeight = pageHeight - RASTER_PDF_MARGIN * 2
  const scale = Math.min(maxWidth / normalized.width, maxHeight / normalized.height)
  const drawWidth = normalized.width * scale
  const drawHeight = normalized.height * scale
  page.drawImage(image, {
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  })
  return { width: pageWidth, height: pageHeight }
}

/**
 * 순서가 보장된 이미지 배열을 하나의 PDF로 만든다. 한 장이라도 손상되면 전체를 실패시킨다.
 */
export async function buildRasterImagesPdfBuffer(images) {
  if (!Array.isArray(images) || images.length === 0) {
    const error = new Error('PDF로 변환할 이미지가 없습니다.')
    error.httpStatus = 400
    throw error
  }
  const pdfDoc = await PDFDocument.create()
  for (const image of images) {
    try {
      await appendRasterImagePage(pdfDoc, image.bytes, image.mime)
    } catch (reason) {
      const error = new Error(`${image.fileName || '이미지'} 파일을 PDF로 변환하지 못했습니다.`)
      error.httpStatus = reason?.httpStatus ?? 422
      throw error
    }
  }
  return Buffer.from(await pdfDoc.save())
}
