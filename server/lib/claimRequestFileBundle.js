import archiver from 'archiver'
import { PDFDocument, rgb } from 'pdf-lib'
import { embedKoreanFont } from '../pdf-engine/renderer/fontProvider.js'

export const CLAIM_BUNDLE_MAX_FILES = 50
export const CLAIM_BUNDLE_MAX_TOTAL_BYTES = 200 * 1024 * 1024

const A4_W = 595.28
const A4_H = 841.89
const IMAGE_MARGIN = 36
const NOTICE_MARGIN = 48
const NOTICE_FONT_SIZE = 11
const NOTICE_LINE_HEIGHT = 16

/**
 * @param {string} fileNameRaw
 * @param {'inline'|'attachment'} mode
 */
export function buildContentDisposition(fileNameRaw, mode = 'attachment') {
  const name = String(fileNameRaw ?? '').trim() || 'download'
  const ascii =
    name
      .replace(/["\r\n\\]/g, '_')
      .replace(/[^\x20-\x7E]/g, '_')
      .trim()
      .slice(0, 200) || 'download'
  const star = encodeURIComponent(name)
  const dispositionType = mode === 'attachment' ? 'attachment' : 'inline'
  return `${dispositionType}; filename="${ascii}"; filename*=UTF-8''${star}`
}

/**
 * @param {string} raw
 */
export function safeClaimBundleFilenameSegment(raw) {
  return sanitizeDownloadFileNamePart(raw)
}

/**
 * @param {unknown} value
 */
export function sanitizeDownloadFileNamePart(value) {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 40)
  return cleaned || '고객'
}

/**
 * @param {unknown} value
 */
export function formatDateForFileName(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '')
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

/**
 * @param {string} customerName
 * @param {unknown} dateLike submitted_at / created_at 등
 * @param {'zip'|'pdf'} kind
 */
export function buildClaimBundleDownloadName(customerName, dateLike, kind) {
  const safeName = sanitizeDownloadFileNamePart(customerName)
  const dateText = formatDateForFileName(dateLike)
  if (kind === 'pdf') {
    return `${safeName}_${dateText}_청구서류.pdf`
  }
  return `${safeName}_${dateText}_원본파일.zip`
}

/**
 * @param {string} contentType
 * @param {string} fileName
 */
export function normalizeClaimFileMime(contentType, fileName) {
  const ct = String(contentType ?? '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    .trim()
  if (ct) {
    return ct
  }
  const ext = String(fileName ?? '')
    .trim()
    .toLowerCase()
    .split('.')
    .pop()
  if (ext === 'jpg' || ext === 'jpeg') {
    return 'image/jpeg'
  }
  if (ext === 'png') {
    return 'image/png'
  }
  if (ext === 'pdf') {
    return 'application/pdf'
  }
  return 'application/octet-stream'
}

/**
 * @param {Array<{ fileName: string }>} files
 */
export function resolveUniqueZipEntryNames(files) {
  /** @type {Map<string, number>} */
  const used = new Map()
  return files.map((file) => {
    const base = String(file.fileName ?? '').trim() || 'file'
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    if (count === 0) {
      return base
    }
    const dot = base.lastIndexOf('.')
    if (dot > 0) {
      const stem = base.slice(0, dot)
      const ext = base.slice(dot)
      return `${stem} (${count})${ext}`
    }
    return `${base} (${count})`
  })
}

/**
 * @param {Array<{ fileSize?: number | null }>} files
 */
export function assertClaimBundleWithinLimits(files) {
  if (!Array.isArray(files) || files.length === 0) {
    const error = new Error('첨부 파일이 없습니다.')
    // @ts-expect-error custom
    error.httpStatus = 400
    throw error
  }
  if (files.length > CLAIM_BUNDLE_MAX_FILES) {
    const error = new Error(
      '첨부파일이 너무 많거나 커서 전체 다운로드를 생성할 수 없습니다. 개별 다운로드를 이용해 주세요.',
    )
    // @ts-expect-error custom
    error.httpStatus = 413
    throw error
  }
  const totalBytes = files.reduce((sum, file) => sum + Number(file.fileSize ?? 0), 0)
  if (totalBytes > CLAIM_BUNDLE_MAX_TOTAL_BYTES) {
    const error = new Error(
      '첨부파일이 너무 많거나 커서 전체 다운로드를 생성할 수 없습니다. 개별 다운로드를 이용해 주세요.',
    )
    // @ts-expect-error custom
    error.httpStatus = 413
    throw error
  }
}

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {Buffer} bytes
 */
async function tryEmbedRaster(pdfDoc, bytes) {
  try {
    return await pdfDoc.embedPng(bytes)
  } catch {
    try {
      return await pdfDoc.embedJpg(bytes)
    } catch {
      return null
    }
  }
}

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {import('pdf-lib').PDFImage} image
 */
function drawImageFitPage(pdfDoc, image) {
  const page = pdfDoc.addPage([A4_W, A4_H])
  const maxW = A4_W - IMAGE_MARGIN * 2
  const maxH = A4_H - IMAGE_MARGIN * 2
  const scale = Math.min(maxW / image.width, maxH / image.height, 1)
  const width = image.width * scale
  const height = image.height * scale
  const x = (A4_W - width) / 2
  const y = (A4_H - height) / 2
  page.drawImage(image, { x, y, width, height })
}

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {import('pdf-lib').PDFFont} font
 * @param {string[]} lines
 */
function appendNoticePage(pdfDoc, font, lines) {
  let page = pdfDoc.addPage([A4_W, A4_H])
  let y = A4_H - NOTICE_MARGIN
  for (const line of lines) {
    if (y < NOTICE_MARGIN) {
      page = pdfDoc.addPage([A4_W, A4_H])
      y = A4_H - NOTICE_MARGIN
    }
    page.drawText(line, {
      x: NOTICE_MARGIN,
      y,
      size: NOTICE_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    })
    y -= NOTICE_LINE_HEIGHT
  }
}

/**
 * @param {Array<{ fileName: string, contentType?: string | null, storageKey: string }>} files
 * @param {(storageKey: string) => Promise<Buffer>} readBuffer
 */
export async function buildClaimFilesPdfBuffer(files, readBuffer) {
  assertClaimBundleWithinLimits(files)

  const pdfDoc = await PDFDocument.create()
  let includedPages = 0
  /** @type {string[]} */
  const skipped = []

  for (const file of files) {
    const fileName = String(file.fileName ?? '').trim() || 'file'
    const mime = normalizeClaimFileMime(file.contentType, fileName)
    let bytes
    try {
      bytes = await readBuffer(String(file.storageKey ?? '').trim())
    } catch {
      skipped.push(fileName)
      continue
    }
    if (!bytes?.length) {
      skipped.push(fileName)
      continue
    }

    if (mime === 'image/jpeg' || mime === 'image/png') {
      const image = await tryEmbedRaster(pdfDoc, bytes)
      if (!image) {
        skipped.push(fileName)
        continue
      }
      drawImageFitPage(pdfDoc, image)
      includedPages += 1
      continue
    }

    if (mime === 'application/pdf') {
      try {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
        const copied = await pdfDoc.copyPages(src, src.getPageIndices())
        for (const page of copied) {
          pdfDoc.addPage(page)
        }
        includedPages += copied.length
      } catch {
        skipped.push(fileName)
      }
      continue
    }

    skipped.push(fileName)
  }

  if (includedPages === 0) {
    const error = new Error('PDF로 변환할 수 있는 첨부 파일이 없습니다. 원본 전체 다운로드를 이용해 주세요.')
    // @ts-expect-error custom
    error.httpStatus = 422
    throw error
  }

  if (skipped.length > 0) {
    const font = await embedKoreanFont(pdfDoc)
    const lines = [
      '다음 파일은 PDF 변환을 지원하지 않아 제외되었습니다.',
      ...skipped.map((name) => `- ${name}`),
      '',
      '원본 전체 다운로드를 이용해 주세요.',
    ]
    appendNoticePage(pdfDoc, font, lines)
  }

  return Buffer.from(await pdfDoc.save())
}

/**
 * @param {import('express').Response} res
 * @param {Array<{ fileName: string, storageKey: string }>} files
 * @param {(storageKey: string) => Promise<Buffer>} readBuffer
 */
/**
 * @param {import('pg').Pool} pool
 * @param {{ agentId: string, requestId: number, customerId?: number | null }} params
 */
export async function loadAgentClaimRequestBundleFiles(pool, { agentId, requestId, customerId = null }) {
  const requestResult = await pool.query(
    `
    SELECT
      r.id,
      r.customer_id,
      COALESCE(NULLIF(TRIM(c.name), ''), '고객') AS customer_name
    FROM customer_claim_requests r
    INNER JOIN customers c ON c.id = r.customer_id
    WHERE r.id = $1
      AND r.agent_id = $2
    LIMIT 1
    `,
    [requestId, agentId],
  )
  if (requestResult.rowCount === 0) {
    const error = new Error('요청을 찾을 수 없습니다.')
    // @ts-expect-error custom
    error.httpStatus = 404
    throw error
  }
  const requestRow = requestResult.rows[0]
  const resolvedCustomerId = Number(requestRow.customer_id)
  if (customerId != null) {
    const parsedCustomerId = Number(customerId)
    if (!Number.isInteger(parsedCustomerId) || parsedCustomerId !== resolvedCustomerId) {
      const error = new Error('요청을 찾을 수 없습니다.')
      // @ts-expect-error custom
      error.httpStatus = 404
      throw error
    }
  }
  const filesResult = await pool.query(
    `
    SELECT
      storage_key,
      file_name,
      content_type,
      file_size
    FROM customer_claim_request_files
    WHERE request_id = $1
    ORDER BY sort_order ASC, id ASC
    `,
    [requestId],
  )
  return {
    customerId: resolvedCustomerId,
    customerName: String(requestRow.customer_name ?? ''),
    submittedAt: requestRow.submitted_at ?? null,
    createdAt: requestRow.created_at ?? null,
    files: filesResult.rows.map((row) => ({
      storageKey: String(row.storage_key ?? ''),
      fileName: String(row.file_name ?? ''),
      contentType: String(row.content_type ?? ''),
      fileSize: Number(row.file_size ?? 0),
    })),
  }
}

export async function pipeClaimFilesZip(res, files, readBuffer) {
  assertClaimBundleWithinLimits(files)
  const entryNames = resolveUniqueZipEntryNames(files)
  const archive = archiver('zip', { zlib: { level: 6 } })

  const archiveDone = new Promise((resolve, reject) => {
    archive.on('error', reject)
    archive.on('end', resolve)
  })

  archive.pipe(res)

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i]
    const key = String(file.storageKey ?? '').trim()
    const buffer = await readBuffer(key)
    archive.append(buffer, { name: entryNames[i] })
  }

  await archive.finalize()
  await archiveDone
}
