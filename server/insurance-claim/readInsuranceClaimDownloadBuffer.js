import { readStorageFileBufferFromPath } from '../lib/storageFileObjectKey.js'
import { getClaimDocumentObject } from './storage/claimDocumentStorage.js'
import {
  getClaimRequestAttachmentObject,
  isGeneratedClaimDocumentKey,
} from './storage/claimRequestAttachmentStorage.js'

/** @typedef {'generated' | 'claim_attachment' | 'customer_app_attachment'} InsuranceClaimDownloadSource */

/**
 * @param {string} storageKey
 * @param {InsuranceClaimDownloadSource | undefined} explicitSource
 * @returns {InsuranceClaimDownloadSource}
 */
export function resolveInsuranceClaimDownloadSource(storageKey, explicitSource) {
  if (
    explicitSource === 'generated' ||
    explicitSource === 'claim_attachment' ||
    explicitSource === 'customer_app_attachment'
  ) {
    return explicitSource
  }
  const key = String(storageKey ?? '').trim()
  if (isGeneratedClaimDocumentKey(key)) {
    return 'generated'
  }
  if (key.startsWith('insurance-claim-requests/')) {
    return 'claim_attachment'
  }
  return 'customer_app_attachment'
}

/**
 * @param {{ storageKey?: string, source?: InsuranceClaimDownloadSource } | string} file
 */
export async function readInsuranceClaimDownloadBuffer(file) {
  const storageKey = String(typeof file === 'string' ? file : file?.storageKey ?? '').trim()
  if (!storageKey) {
    throw new Error('storage key missing')
  }
  const source = resolveInsuranceClaimDownloadSource(
    storageKey,
    typeof file === 'object' ? file?.source : undefined,
  )
  if (source === 'generated') {
    return getClaimDocumentObject(storageKey)
  }
  if (source === 'claim_attachment') {
    return getClaimRequestAttachmentObject(storageKey)
  }
  return readStorageFileBufferFromPath(storageKey)
}
