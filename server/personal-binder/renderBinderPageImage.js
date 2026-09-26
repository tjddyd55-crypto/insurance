import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

const require = createRequire(import.meta.url)
const PDFJS_ROOT = path.dirname(require.resolve('pdfjs-dist/package.json'))

export const MAX_BINDER_PAGE_SOURCE_BYTES = 40 * 1024 * 1024
const MAX_RENDER_EDGE = 4096
const JPEG_QUALITY = 82
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'])

function httpError(status, message) {
  return Object.assign(new Error(message), { httpStatus: status })
}

export function classifyBinderSource(mimeType) {
  const mime = String(mimeType ?? '').toLowerCase().split(';')[0].trim()
  if (mime === 'application/pdf') return 'pdf'
  if (IMAGE_MIME_TYPES.has(mime)) return 'image'
  return 'unsupported'
}

export function sourcePageCount(kind, storedPageCount) {
  if (kind === 'image') return 1
  const count = Number(storedPageCount)
  if (!Number.isInteger(count) || count < 1) {
    throw httpError(409, '자료 페이지 수를 확인할 수 없습니다.')
  }
  return count
}

function pdfjsAssetUrl(folder) {
  return pathToFileURL(path.join(PDFJS_ROOT, folder) + path.sep).href
}

function viewportForTargetWidth(page, targetWidth) {
  const base = page.getViewport({ scale: 1 })
  let scale = targetWidth / base.width
  if (base.height * scale > MAX_RENDER_EDGE) scale = MAX_RENDER_EDGE / base.height
  if (base.width * scale > MAX_RENDER_EDGE) scale = MAX_RENDER_EDGE / base.width
  return page.getViewport({ scale })
}

async function renderPdfPage(buffer, pageNumber, targetWidth) {
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw httpError(422, 'PDF 파일 형식이 올바르지 않습니다.')
  }
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = await getDocument({
    data: new Uint8Array(buffer),
    cMapUrl: pdfjsAssetUrl('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: pdfjsAssetUrl('standard_fonts'),
    useSystemFonts: false,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise
  try {
    return await rasterizePdfPage(pdf, pageNumber, targetWidth)
  } catch (error) {
    throw mapPdfRenderError(error)
  } finally {
    await pdf.destroy()
  }
}

async function rasterizePdfPage(pdf, pageNumber, targetWidth) {
  if (pageNumber > pdf.numPages) {
    throw httpError(400, '페이지 범위를 벗어났습니다.')
  }
  const page = await pdf.getPage(pageNumber)
  const viewport = viewportForTargetWidth(page, targetWidth)
  const pixelWidth = Math.max(1, Math.round(viewport.width))
  const pixelHeight = Math.max(1, Math.round(viewport.height))
  const canvasAndContext = pdf.canvasFactory.create(pixelWidth, pixelHeight)
  try {
    await page.render({ canvasContext: canvasAndContext.context, viewport }).promise
    return {
      buffer: canvasAndContext.canvas.toBuffer('image/jpeg', JPEG_QUALITY),
      contentType: 'image/jpeg',
      pixelWidth,
      pixelHeight,
    }
  } finally {
    page.cleanup()
    pdf.canvasFactory.destroy(canvasAndContext)
  }
}

function mapPdfRenderError(error) {
  if (error?.httpStatus) return error
  const name = String(error?.name ?? '')
  if (name === 'PasswordException' || /password|encrypt/i.test(String(error?.message ?? ''))) {
    return httpError(422, '암호화된 PDF는 페이지 이미지로 열 수 없습니다.')
  }
  return httpError(422, '페이지 이미지를 만들지 못했습니다.')
}

async function renderRasterImage(buffer, pageNumber, targetWidth) {
  if (pageNumber !== 1) throw httpError(400, '이미지 자료는 1페이지만 있습니다.')
  try {
    const output = await sharp(buffer)
      .rotate()
      .resize({ width: targetWidth, withoutEnlargement: true, fit: 'inside' })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer({ resolveWithObject: true })
    return {
      buffer: output.data,
      contentType: 'image/jpeg',
      pixelWidth: output.info.width,
      pixelHeight: output.info.height,
    }
  } catch {
    throw httpError(422, '이미지 자료를 열 수 없습니다.')
  }
}

/**
 * PDF 는 벡터로 targetWidth 에 맞추고, 래스터 이미지는 확대하지 않는다.
 * @returns {Promise<{ buffer: Buffer, contentType: 'image/jpeg', pixelWidth: number, pixelHeight: number }>}
 */
export async function renderBinderPageImage({ buffer, mimeType, page, width }) {
  const kind = classifyBinderSource(mimeType)
  if (kind === 'unsupported') throw httpError(415, '페이지 이미지로 열 수 없는 파일 형식입니다.')
  if (!buffer?.length) throw httpError(404, '원본 파일을 찾을 수 없습니다.')
  if (buffer.length > MAX_BINDER_PAGE_SOURCE_BYTES) throw httpError(413, '원본 파일이 너무 큽니다.')
  if (kind === 'image') return renderRasterImage(buffer, page, width)
  return renderPdfPage(buffer, page, width)
}
