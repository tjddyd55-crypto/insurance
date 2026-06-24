import { PDFDocument } from 'pdf-lib'

/**
 * @typedef {{
 *   fileName: string,
 *   startPage: number,
 *   endPage: number,
 *   pageCount: number,
 * }} PdfSourceFileMetadata
 */

/**
 * @param {Buffer | Uint8Array | null | undefined} buffer
 */
export function assertPdfBufferHeader(buffer) {
  if (!buffer || buffer.length < 5) {
    throw new Error('PDF 파일만 업로드할 수 있습니다.')
  }
  const head = Buffer.from(buffer.subarray(0, 5)).toString('ascii')
  if (head !== '%PDF-') {
    throw new Error('PDF 파일만 업로드할 수 있습니다.')
  }
}

/**
 * 업로드된 PDF 버퍼들을 선택 순서대로 하나의 PDF로 병합한다.
 *
 * @param {Array<{ buffer: Buffer, fileName: string }>} items
 * @returns {Promise<{ mergedBuffer: Buffer, pageCount: number, sourcePdfMetadata: PdfSourceFileMetadata[] }>}
 */
export async function mergePdfUploadBuffers(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('PDF 파일이 필요합니다.')
  }

  for (const item of items) {
    if (!item?.buffer || item.buffer.length === 0) {
      throw new Error('빈 PDF 파일은 업로드할 수 없습니다.')
    }
    assertPdfBufferHeader(item.buffer)
  }

  if (items.length === 1) {
    const only = items[0]
    let doc
    try {
      doc = await PDFDocument.load(only.buffer, { ignoreEncryption: true })
    } catch {
      throw new Error('1번째 파일을 읽을 수 없습니다.')
    }
    const pageCount = doc.getPageCount()
    if (pageCount < 1) {
      throw new Error('1번째 PDF에 페이지가 없습니다.')
    }
    return {
      mergedBuffer: Buffer.from(only.buffer),
      pageCount,
      sourcePdfMetadata: [
        {
          fileName: only.fileName || 'document.pdf',
          startPage: 1,
          endPage: pageCount,
          pageCount,
        },
      ],
    }
  }

  const mergedDoc = await PDFDocument.create()
  /** @type {PdfSourceFileMetadata[]} */
  const sourcePdfMetadata = []
  let startPage = 1

  for (let i = 0; i < items.length; i += 1) {
    const { buffer, fileName } = items[i]
    let srcDoc
    try {
      srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
    } catch {
      throw new Error(`${i + 1}번째 파일을 읽을 수 없습니다.`)
    }
    const pageCount = srcDoc.getPageCount()
    if (pageCount < 1) {
      throw new Error(`${i + 1}번째 PDF에 페이지가 없습니다.`)
    }
    const indices = Array.from({ length: pageCount }, (_, idx) => idx)
    let copied
    try {
      copied = await mergedDoc.copyPages(srcDoc, indices)
    } catch {
      throw new Error('PDF 병합 중 오류가 발생했습니다.')
    }
    for (const page of copied) {
      mergedDoc.addPage(page)
    }
    sourcePdfMetadata.push({
      fileName: fileName || `file-${i + 1}.pdf`,
      startPage,
      endPage: startPage + pageCount - 1,
      pageCount,
    })
    startPage += pageCount
  }

  let mergedBytes
  try {
    mergedBytes = await mergedDoc.save()
  } catch {
    throw new Error('PDF 병합 중 오류가 발생했습니다.')
  }
  const mergedBuffer = Buffer.from(mergedBytes)

  let verify
  try {
    verify = await PDFDocument.load(mergedBuffer, { ignoreEncryption: true })
  } catch {
    throw new Error('PDF 병합 중 오류가 발생했습니다.')
  }

  return {
    mergedBuffer,
    pageCount: verify.getPageCount(),
    sourcePdfMetadata,
  }
}
