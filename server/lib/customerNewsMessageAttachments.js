import { randomUUID } from 'node:crypto'

export const CUSTOMER_NEWS_MESSAGE_ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
])

export const CUSTOMER_NEWS_MESSAGE_MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const CUSTOMER_NEWS_MESSAGE_MAX_PDF_BYTES = 10 * 1024 * 1024

/**
 * @param {string} contentType
 */
export function maxBytesForCustomerNewsMessageMime(contentType) {
  return contentType === 'application/pdf'
    ? CUSTOMER_NEWS_MESSAGE_MAX_PDF_BYTES
    : CUSTOMER_NEWS_MESSAGE_MAX_IMAGE_BYTES
}

/**
 * @param {string} contentType
 * @param {number} sizeBytes
 */
export function validateCustomerNewsMessageUpload(contentType, sizeBytes) {
  const mime = String(contentType ?? '').trim().split(';')[0].trim()
  if (!CUSTOMER_NEWS_MESSAGE_ALLOWED_MIME.has(mime)) {
    return { ok: false, message: 'JPG, PNG, WEBP, GIF 이미지 또는 PDF만 첨부할 수 있습니다.' }
  }
  const maxB = maxBytesForCustomerNewsMessageMime(mime)
  if (!Number.isFinite(sizeBytes) || sizeBytes < 1 || sizeBytes > maxB) {
    return { ok: false, message: '첨부파일은 10MB 이하만 업로드할 수 있습니다.' }
  }
  return { ok: true, mime }
}

/**
 * @param {string} gaPath
 * @param {string} agentId
 * @param {string} fileName
 */
export function buildCustomerNewsMessageObjectKey(gaPath, agentId, fileName) {
  const userSeg = String(agentId ?? '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 128) || '_'
  const safeName =
    String(fileName ?? 'file')
      .trim()
      .replace(/[^\w.\-()\u3131-\u318e\uac00-\ud7a3]/g, '_')
      .slice(0, 120) || 'file'
  return `insurer/${gaPath}/${userSeg}/customer-news-attachments/${Date.now()}-${randomUUID()}-${safeName}`
}

/**
 * @param {string} objectKey
 * @param {string} agentId
 * @param {string} gaPath
 */
export function assertCustomerNewsMessageObjectKey(objectKey, agentId, gaPath) {
  const key = String(objectKey ?? '').trim().replace(/^\//, '')
  if (!key) {
    return false
  }
  const userSeg = String(agentId ?? '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 128) || '_'
  const prefix = `insurer/${gaPath}/${userSeg}/customer-news-attachments/`
  return key.startsWith(prefix)
}

/**
 * @param {unknown} raw
 * @returns {'image' | 'file'}
 */
export function customerNewsAttachmentKindFromMime(raw) {
  return String(raw ?? '').trim() === 'application/pdf' ? 'file' : 'image'
}

/**
 * @param {unknown} raw
 */
function sanitizeCustomerNewsAttachmentFileName(raw, fallbackIndex) {
  const name = String(raw ?? '').trim()
  const base = name || `attachment-${fallbackIndex + 1}`
  return base.replace(/[^\w.\-()\u3131-\u318e\uac00-\ud7a3]/g, '_').slice(0, 120) || `attachment-${fallbackIndex + 1}`
}

/**
 * payload.attachments 항목 1개 정규화. 저장된 id 를 유지해 고객앱 download URL 과 DB payload 가 일치해야 한다.
 * @param {unknown} item
 * @param {number} index
 */
export function normalizeCustomerNewsAttachmentRow(item, index) {
  if (!item || typeof item !== 'object') {
    return null
  }
  const row = /** @type {{ id?: unknown, attachmentId?: unknown, kind?: unknown, url?: unknown, objectKey?: unknown, fileName?: unknown, mimeType?: unknown, size?: unknown, sortOrder?: unknown }} */ (
    item
  )
  const kind = String(row.kind ?? '') === 'file' ? 'file' : 'image'
  const url = String(row.url ?? '').trim()
  const objectKey = String(row.objectKey ?? '').trim()
  const fileName = sanitizeCustomerNewsAttachmentFileName(row.fileName, index)
  const mimeType = String(row.mimeType ?? '').trim().slice(0, 120)
  const size = Number(row.size ?? 0)
  const sortOrder = Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index
  if (!url && !objectKey) {
    return null
  }
  const idRaw = String(row.id ?? row.attachmentId ?? '').trim()
  const id = idRaw || randomUUID()
  return {
    id,
    kind,
    url,
    fileName,
    sortOrder,
    ...(objectKey ? { objectKey } : {}),
    ...(mimeType ? { mimeType } : {}),
    ...(Number.isFinite(size) && size > 0 ? { size } : {}),
  }
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof normalizeCustomerNewsAttachmentRow>[]}
 */
export function normalizeCustomerNewsAttachments(raw) {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .map((item, index) => normalizeCustomerNewsAttachmentRow(item, index))
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/**
 * @param {object | null | undefined} payload
 * @param {string} attachmentId
 */
export function findCustomerNewsAttachmentInPayload(payload, attachmentId) {
  const list = Array.isArray(payload?.attachments) ? payload.attachments : []
  const target = String(attachmentId ?? '').trim()
  if (!target || list.length === 0) {
    return null
  }
  for (const item of list) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const row = /** @type {{ id?: unknown, attachmentId?: unknown }} */ (item)
    const id = String(row.id ?? '').trim()
    const altId = String(row.attachmentId ?? '').trim()
    if (id === target || altId === target) {
      return item
    }
  }
  if (/^\d+$/.test(target)) {
    const idx = Number(target)
    if (idx >= 1 && idx <= list.length) {
      const legacy = list[idx - 1]
      return legacy && typeof legacy === 'object' ? legacy : null
    }
  }
  return null
}
