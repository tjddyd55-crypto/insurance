import { randomUUID } from 'node:crypto'
import {
  consentGetBuffer,
  consentPutObject,
  r2DeleteStorageObjectOrThrow,
} from '../../lib/consentStorage.js'

const KEY_PREFIX = 'insurance-claim-documents'

/**
 * @param {{ companyId: number, documentType: string }} input
 */
export function buildClaimDocumentStorageKey({ companyId, documentType }) {
  const safeType = String(documentType ?? 'doc')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
  return `${KEY_PREFIX}/company-${companyId}/${safeType}-${randomUUID()}.pdf`
}

export function putClaimDocumentObject(key, body) {
  return consentPutObject(key, body, 'application/pdf')
}

export function getClaimDocumentObject(key) {
  return consentGetBuffer(key)
}

export function deleteClaimDocumentObject(key) {
  return r2DeleteStorageObjectOrThrow(key)
}
