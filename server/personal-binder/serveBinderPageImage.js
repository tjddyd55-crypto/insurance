import { createHash } from 'node:crypto'

import { readStorageFileBufferFromPath } from '../lib/storageFileObjectKey.js'
import { binderPageImageCacheKey, createBinderPageImageCache } from './binderPageImageCache.js'
import { loadOwnedBinderMaterialFile } from './loadOwnedBinderMaterialFile.js'
import { loadActiveSharedBinderFile } from './loadActiveSharedBinderFile.js'
import {
  classifyBinderSource,
  MAX_BINDER_PAGE_SOURCE_BYTES,
  renderBinderPageImage,
  sourcePageCount,
} from './renderBinderPageImage.js'

function httpError(status, message) {
  return Object.assign(new Error(message), { httpStatus: status })
}

function storedFingerprint(row) {
  const checksum = String(row.checksum_sha256 ?? '').trim().toLowerCase()
  return /^[a-f0-9]{64}$/.test(checksum) ? checksum.slice(0, 16) : ''
}

async function readBoundedFile(readFileBuffer, row) {
  const fileSize = Number(row.file_size) || 0
  if (fileSize > MAX_BINDER_PAGE_SOURCE_BYTES) {
    throw httpError(413, '원본 파일이 너무 큽니다.')
  }
  const buffer = await readFileBuffer(row.file_path)
  if (!buffer?.length) throw httpError(404, '원본 파일을 찾을 수 없습니다.')
  if (buffer.length > MAX_BINDER_PAGE_SOURCE_BYTES) throw httpError(413, '원본 파일이 너무 큽니다.')
  return buffer
}

function assertPageInRange(page, pageCount) {
  if (!Number.isInteger(page) || page < 1 || page > pageCount) {
    throw httpError(400, '페이지 범위를 벗어났습니다.')
  }
}

async function renderStored(readFileBuffer, row, mimeType, page, width) {
  const buffer = await readBoundedFile(readFileBuffer, row)
  return renderBinderPageImage({ buffer, mimeType, page, width })
}

/**
 * 디스크 캐시 키는 file id + 내용 fingerprint + page + width.
 * checksum 이 있으면 원본을 다시 읽기 전에 캐시를 본다.
 */
export function createBinderPageImageService(ctx) {
  const cache = createBinderPageImageCache(ctx.cacheDir)
  const readFileBuffer = ctx.readFileBuffer ?? readStorageFileBufferFromPath

  /**
   * 렌더링·캐시 공통 경로. 자기 자료와 공유 스냅샷 파일이 같은 파이프라인을 탄다.
   * @param {{ cacheFileId: number, namespace?: string, row: Record<string, unknown>, mimeType: string }} source
   */
  async function renderSourcePage(source, page, width) {
    const { row, mimeType } = source
    const kind = classifyBinderSource(mimeType)
    if (kind === 'unsupported') throw httpError(415, '페이지 이미지로 열 수 없는 파일 형식입니다.')
    const pageCount = sourcePageCount(kind, row.page_count)
    assertPageInRange(page, pageCount)
    const keyBase = { fileId: source.cacheFileId, namespace: source.namespace ?? '', page, width }
    const known = storedFingerprint(row)
    const image = known
      ? await cache.getOrCreate(
        binderPageImageCacheKey({ ...keyBase, fingerprint: known }),
        () => renderStored(readFileBuffer, row, mimeType, page, width),
      )
      : await renderUnchecksummed(cache, readFileBuffer, row, mimeType, keyBase)
    return { row, kind, mimeType, pageCount, image }
  }

  async function renderMaterialPage(scope, materialId, page, width) {
    const row = await loadOwnedBinderMaterialFile(ctx.pool, materialId, scope)
    if (!row) throw httpError(404, '자료를 찾을 수 없습니다.')
    const mimeType = String(row.file_mime || row.material_mime || '')
    return renderSourcePage({ cacheFileId: row.file_id, row, mimeType }, page, width)
  }

  /** 공유 받은 사람(같은 GA)만, 공유가 active 일 때만. 매 호출 DB 로 다시 확인한다. */
  async function renderSharedFilePage(scope, shareId, shareFileId, page, width) {
    const row = await loadActiveSharedBinderFile(ctx.pool, scope, shareId, shareFileId)
    if (!row) throw httpError(404, '공유 바인더를 찾을 수 없습니다.')
    return renderSourcePage(
      { cacheFileId: row.share_file_id, namespace: 'share', row, mimeType: String(row.file_mime || '') },
      page,
      width,
    )
  }

  return { renderMaterialPage, renderSharedFilePage }
}

async function renderUnchecksummed(cache, readFileBuffer, row, mimeType, keyBase) {
  const buffer = await readBoundedFile(readFileBuffer, row)
  const fingerprint = createHash('sha256').update(buffer).digest('hex').slice(0, 16)
  const key = binderPageImageCacheKey({ ...keyBase, fingerprint })
  return cache.getOrCreate(key, () => renderBinderPageImage({ buffer, mimeType, page: keyBase.page, width: keyBase.width }))
}
