import { createHash, randomUUID } from 'node:crypto'
import { stripR2ObjectRootIfPresent } from './r2KeyPolicy.js'

export const CUSTOMER_NEWS_ATTACHMENT_ONLY_TITLE = '첨부파일 안내'

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
 * @param {string} userId
 */
function sanitizeAgentObjectKeySegment(userId) {
  const s = String(userId ?? '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 128)
  return s || '_'
}

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
  const userSeg = sanitizeAgentObjectKeySegment(agentId)
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
  const key = stripR2ObjectRootIfPresent(String(objectKey ?? '').trim().replace(/^\//, ''))
  if (!key) {
    return false
  }
  const userSeg = sanitizeAgentObjectKeySegment(agentId)
  const prefix = `insurer/${gaPath}/${userSeg}/customer-news-attachments/`
  return key.startsWith(prefix)
}

/**
 * payload 첨부 1건에서 R2 objectKey 를 복원한다. objectKey 필드를 우선하고 CDN url 은 fallback.
 * @param {unknown} attachment
 * @param {string} [cdnBase]
 */
export function resolveCustomerNewsAttachmentObjectKey(attachment, cdnBase = '') {
  if (!attachment || typeof attachment !== 'object') {
    return ''
  }
  const row = /** @type {{ objectKey?: unknown, url?: unknown }} */ (attachment)
  const objectKey = String(row.objectKey ?? '').trim().replace(/^\//, '')
  if (objectKey) {
    return objectKey
  }
  const url = String(row.url ?? '').trim()
  if (!url) {
    return ''
  }
  if (url.includes('/attachments/') && url.includes('accessToken=')) {
    return ''
  }
  const base = String(cdnBase ?? '').replace(/\/$/, '')
  if (base && url.startsWith(`${base}/`)) {
    return url.slice(base.length + 1).replace(/^\//, '')
  }
  try {
    const parsed = new URL(url)
    return parsed.pathname.replace(/^\//, '')
  } catch {
    return ''
  }
}

/**
 * R2 GetObject 에 쓸 storage key. payload.objectKey 를 DB 저장값 그대로 우선한다.
 * @param {unknown} attachment
 * @param {string} [cdnBase]
 */
export function resolveCustomerNewsAttachmentStorageKey(attachment, cdnBase = '') {
  return resolveCustomerNewsAttachmentObjectKey(attachment, cdnBase)
}

/**
 * @param {string} objectKey
 */
export function isSafeCustomerNewsStorageObjectKey(objectKey) {
  const key = String(objectKey ?? '').trim().replace(/^\//, '')
  return key.length > 0 && key.length <= 1024 && !key.includes('..')
}

/**
 * @param {string} objectKey
 */
export function classifyCustomerNewsObjectKeyPrefixType(objectKey) {
  const key = stripR2ObjectRootIfPresent(String(objectKey ?? '').trim().replace(/^\//, ''))
  if (!key) {
    return 'empty'
  }
  if (key.includes('/customer-news-attachments/')) {
    return 'customer-news-attachments'
  }
  if (key.startsWith('files/')) {
    return 'storage-files'
  }
  if (key.includes('/customer-news')) {
    return 'customer-news-other'
  }
  if (key.includes('/insurer-news/')) {
    return 'insurer-news'
  }
  return 'other'
}

/**
 * payload 에서 찾은 첨부의 storage key 가 해당 row 와 일치하는지 확인한다.
 * @param {string} storageKey
 * @param {unknown} attachment
 * @param {string} [cdnBase]
 */
export function assertCustomerNewsPayloadAttachmentStorageKey(storageKey, attachment, cdnBase = '') {
  if (!isSafeCustomerNewsStorageObjectKey(storageKey)) {
    return false
  }
  const expected = resolveCustomerNewsAttachmentStorageKey(attachment, cdnBase)
  if (!expected) {
    return false
  }
  const norm = (value) => stripR2ObjectRootIfPresent(String(value ?? '').trim().replace(/^\//, ''))
  return norm(storageKey) === norm(expected)
}

/**
 * @param {{ title?: unknown, content?: unknown, attachments?: unknown }} input
 */
export function validateCustomerNewsMessageCreateInput(input) {
  const title = String(input?.title ?? '').trim()
  const content = String(input?.content ?? '').trim()
  const attachments = normalizeCustomerNewsAttachments(input?.attachments)
  if (!title && !content && attachments.length === 0) {
    return { ok: false, message: '제목, 내용, 첨부파일 중 하나 이상을 입력해 주세요.' }
  }
  const titleForRow =
    title || (attachments.length > 0 ? CUSTOMER_NEWS_ATTACHMENT_ONLY_TITLE : '고객 메시지')
  return { ok: true, titleForRow, bodyText: content, attachments }
}

/**
 * @param {{
 *  title?: unknown
 *  attachments?: unknown
 *  scope?: unknown
 *  customerName?: unknown
 * }} params
 */
export function resolveCustomerNewsDisplayTitle(params) {
  const scope = String(params?.scope ?? 'all') === 'personal' ? 'personal' : 'all'
  const customerName = String(params?.customerName ?? '').trim()
  if (scope === 'personal' && customerName) {
    return `${customerName} 고객님께`
  }
  const title = String(params?.title ?? '').trim()
  if (title && title !== '고객 메시지' && title !== CUSTOMER_NEWS_ATTACHMENT_ONLY_TITLE) {
    return title
  }
  const attachments = normalizeCustomerNewsAttachments(params?.attachments)
  if (attachments.length > 0) {
    const fileName = String(attachments[0]?.fileName ?? '').trim()
    const isAutoGeneratedName = /^attachment-\d+$/.test(fileName)
    if (fileName && !isAutoGeneratedName) {
      return fileName
    }
    return CUSTOMER_NEWS_ATTACHMENT_ONLY_TITLE
  }
  return title || '고객 메시지'
}

/**
 * @param {object | null | undefined} payload
 * @param {string} attachmentId
 */
export function resolveCustomerNewsAttachmentForDownload(payload, attachmentId) {
  const normalizedAttachments = normalizeCustomerNewsAttachments(payload?.attachments)
  const target = String(attachmentId ?? '').trim()
  let attachment = normalizedAttachments.find((row) => row.id === target) ?? null
  if (!attachment) {
    const legacyRow = findCustomerNewsAttachmentInPayload(payload, attachmentId)
    attachment = legacyRow ? normalizeCustomerNewsAttachments([legacyRow])[0] ?? null : null
  }
  return attachment
}

/**
 * 고객앱 소식지 첨부 다운로드 허용 objectKey 인지 검증한다.
 * @param {string} objectKey
 * @param {string} agentId
 * @param {string} gaPath
 */
export function assertCustomerNewsAttachmentReadable(objectKey, agentId, gaPath) {
  const key = stripR2ObjectRootIfPresent(String(objectKey ?? '').trim().replace(/^\//, ''))
  if (!key || key.includes('..')) {
    return false
  }
  if (assertCustomerNewsMessageObjectKey(key, agentId, gaPath)) {
    return true
  }
  const userSeg = sanitizeAgentObjectKeySegment(agentId)
  if (key.includes(`/${userSeg}/`) && (key.includes('/insurer-news/') || key.includes('/customer-news'))) {
    return true
  }
  const crmFilesPrefix = `files/${userSeg}/`
  if (key.startsWith(crmFilesPrefix)) {
    const fileSeg = key.slice(crmFilesPrefix.length)
    if (!fileSeg.includes('/') && /^\d+-.+/.test(fileSeg)) {
      return true
    }
  }
  return false
}

/**
 * @param {unknown} raw
 * @returns {'image' | 'file'}
 */
export function customerNewsAttachmentKindFromMime(raw) {
  return String(raw ?? '').trim() === 'application/pdf' ? 'file' : 'image'
}

/**
 * payload 에 id 가 없을 때 요청마다 동일한 attachmentId 를 복원한다 (download URL·accessToken 일치).
 * @param {unknown} row
 * @param {number} index
 */
function stableCustomerNewsAttachmentId(row, index) {
  if (!row || typeof row !== 'object') {
    return `legacy-${index + 1}`
  }
  const item = /** @type {{ objectKey?: unknown, url?: unknown, fileName?: unknown }} */ (row)
  const objectKey = String(item.objectKey ?? '').trim()
  const url = String(item.url ?? '').trim()
  const fileName = String(item.fileName ?? '').trim()
  const basis = objectKey || url || `${fileName}#${index}`
  if (!basis) {
    return `legacy-${index + 1}`
  }
  return createHash('sha256').update(`customer-news-attachment:${basis}`).digest('hex').slice(0, 32)
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
  const id = idRaw || stableCustomerNewsAttachmentId(row, index)
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
