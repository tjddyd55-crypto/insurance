import { randomUUID } from 'node:crypto'
import { consentGetBuffer, consentPutObject } from '../../lib/consentStorage.js'

const KEY_PREFIX = 'insurance-claim-requests'

function safeFileSegment(fileName, fallback = 'file') {
  const trimmed = String(fileName ?? '').trim() || fallback
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
}

/**
 * @param {number} claimRequestId
 * @param {string} fileName
 */
export function buildClaimRequestAttachmentStorageKey(claimRequestId, fileName) {
  return `${KEY_PREFIX}/${claimRequestId}/attachments/${randomUUID()}-${safeFileSegment(fileName)}`
}

/**
 * @param {number} claimRequestId
 * @param {'insured' | 'contractor'} role
 * @param {string} fileName
 */
export function buildClaimRequestSignatureStorageKey(claimRequestId, role, fileName) {
  const safeRole = role === 'contractor' ? 'contractor' : 'insured'
  return `${KEY_PREFIX}/${claimRequestId}/signatures/${safeRole}-${randomUUID()}-${safeFileSegment(fileName, 'signature.png')}`
}

export function putClaimRequestAttachmentObject(key, body, contentType) {
  return consentPutObject(key, body, contentType || 'application/octet-stream')
}

export function getClaimRequestAttachmentObject(key) {
  return consentGetBuffer(key)
}

export function isGeneratedClaimDocumentKey(storageKey) {
  return String(storageKey ?? '').startsWith('insurance-claim-documents/')
}
