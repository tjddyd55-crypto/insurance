import { createHash } from 'node:crypto'
import { PDFDocument } from 'pdf-lib'

import { buildRasterImagesPdfBuffer, isRasterImageMime } from '../pdf-engine/raster/rasterImagePdf.js'

export const BINDER_MATERIAL_SOURCE_TYPES = new Set([
  'personal',
  'official',
  'my_file',
  'team_file',
])

export const BINDER_MATERIAL_ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
])

export function normalizeBinderMaterialMime(mime, fileName) {
  const normalized = String(mime ?? '').toLowerCase().split(';')[0].trim()
  if (BINDER_MATERIAL_ALLOWED_MIMES.has(normalized)) {
    return normalized === 'image/jpg' ? 'image/jpeg' : normalized
  }
  const lower = String(fileName ?? '').toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.png')) return 'image/png'
  return normalized
}

export function assertBinderMaterialMime(mime) {
  if (!BINDER_MATERIAL_ALLOWED_MIMES.has(mime) && mime !== 'image/jpeg') {
    throw Object.assign(new Error('PDF 또는 이미지(JPG/PNG) 파일만 자료로 등록할 수 있습니다.'), {
      httpStatus: 400,
    })
  }
}

export async function resolveBinderMaterialPageCount(buffer, mime) {
  if (mime === 'application/pdf') {
    if (!buffer?.length || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw Object.assign(new Error('PDF 파일 형식이 올바르지 않습니다.'), { httpStatus: 400 })
    }
    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: false })
    const pageCount = pdf.getPageCount()
    if (pageCount < 1) {
      throw Object.assign(new Error('페이지가 없는 PDF입니다.'), { httpStatus: 400 })
    }
    return pageCount
  }
  if (isRasterImageMime(mime) || mime === 'image/jpeg') {
    if (!buffer?.length) {
      throw Object.assign(new Error('이미지 파일을 읽을 수 없습니다.'), { httpStatus: 400 })
    }
    return 1
  }
  throw Object.assign(new Error('지원하지 않는 파일 형식입니다.'), { httpStatus: 400 })
}

export function binderMaterialChecksum(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * @param {Array<{ bytes: Buffer, mime: string, fileName: string }>} images
 */
export async function buildBinderMaterialPdfFromImages(images) {
  return buildRasterImagesPdfBuffer(images)
}
