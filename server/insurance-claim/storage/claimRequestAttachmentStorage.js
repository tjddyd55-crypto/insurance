import { consentGetBuffer, consentPutObject } from '../../lib/consentStorage.js'
import {
  assertInsuranceStorageKeyPrefix,
  buildInsuranceClaimRequestAttachmentKey,
  buildInsuranceClaimRequestSignatureKey,
  isInsuranceClaimRequestAttachmentKey,
  isInsuranceClaimRequestGeneratedKey,
} from '../../storage/insuranceStorageKeys.js'

/**
 * @param {string | number} userId
 * @param {number | string} claimRequestId
 * @param {string} fileName
 */
export function buildClaimRequestAttachmentStorageKey(userId, claimRequestId, fileName) {
  return buildInsuranceClaimRequestAttachmentKey({ userId, claimRequestId, fileName })
}

/**
 * @param {string | number} userId
 * @param {number | string} claimRequestId
 * @param {'insured' | 'contractor'} role
 * @param {string} fileName
 */
export function buildClaimRequestSignatureStorageKey(userId, claimRequestId, role, fileName) {
  return buildInsuranceClaimRequestSignatureKey({ userId, claimRequestId, role, fileName })
}

export function putClaimRequestAttachmentObject(key, body, contentType) {
  assertInsuranceStorageKeyPrefix(key)
  return consentPutObject(key, body, contentType || 'application/octet-stream')
}

export function getClaimRequestAttachmentObject(key) {
  return consentGetBuffer(key)
}

export function isGeneratedClaimDocumentKey(storageKey) {
  return isInsuranceClaimRequestGeneratedKey(storageKey)
}

export function isClaimRequestAttachmentStorageKey(storageKey) {
  return isInsuranceClaimRequestAttachmentKey(storageKey)
}
