import { consentGetBuffer, isR2ObjectNotFoundError } from '../lib/consentStorage.js'
import {
  INSURANCE_STORAGE_BUCKET,
  INSURANCE_STORAGE_CATEGORY,
  buildInsuranceUserStorageKey,
  normalizeInsuranceGaCode,
  sanitizeInsuranceFileName,
  stripInsuranceStorageKey,
} from '../lib/insuranceStorageLayout.js'
import {
  collectStorageFileObjectKeyCandidates,
  STORAGE_FILE_READ_USER_MESSAGE,
} from '../lib/storageFileObjectKey.js'
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
 * @param {string | null | undefined} storageKey
 * @param {{
 *   gaCode?: string | null,
 *   agentId?: string | null,
 *   customerId?: number | null,
 *   requestId?: number | null,
 *   fileName?: string | null,
 * }} [context]
 * @returns {string[]}
 */
export function collectCustomerClaimAppAttachmentKeyCandidates(storageKey, context = {}) {
  /** @type {string[]} */
  const merged = []
  const seen = new Set()
  const pushRaw = (raw) => {
    for (const candidate of collectStorageFileObjectKeyCandidates(raw)) {
      if (!candidate || seen.has(candidate)) {
        continue
      }
      seen.add(candidate)
      merged.push(candidate)
    }
  }

  pushRaw(storageKey)

  const stripped = stripInsuranceStorageKey(storageKey)
  if (!stripped) {
    return merged
  }

  if (stripped.startsWith('insurer/') && !stripped.startsWith(`${INSURANCE_STORAGE_BUCKET}/`)) {
    pushRaw(`${INSURANCE_STORAGE_BUCKET}/${stripped}`)
  }
  if (stripped.startsWith(`${INSURANCE_STORAGE_BUCKET}/insurer/`)) {
    pushRaw(stripped.slice(`${INSURANCE_STORAGE_BUCKET}/`.length))
  }

  const legacy = stripped.match(/^insurer\/([^/]+)\/([^/]+)\/customer-app-claims\/(.+)$/)
  if (!legacy) {
    return merged
  }

  const gaCode = normalizeInsuranceGaCode(context.gaCode ?? legacy[1])
  const userSeg = legacy[2]
  const fileSeg = legacy[3]
  const customerId = context.customerId
  const requestId = context.requestId
  const fileName = String(context.fileName ?? '').trim()

  if (!gaCode || !userSeg || customerId == null || requestId == null) {
    return merged
  }

  const tsMatch = fileSeg.match(/^(\d{13})-/)
  const ts = tsMatch ? Number(tsMatch[1]) : NaN
  const uploadedAt = Number.isFinite(ts) ? new Date(ts) : null
  if (!uploadedAt || Number.isNaN(uploadedAt.getTime())) {
    return merged
  }

  const ssotFileName = fileName || fileSeg.replace(/^\d{13}-(?:[0-9a-f-]+-)+/i, '')
  try {
    const ssotKey = buildInsuranceUserStorageKey({
      gaCode,
      userId: userSeg,
      category: INSURANCE_STORAGE_CATEGORY.CUSTOMER_CLAIM_APP_FILES,
      customerId,
      claimId: requestId,
      originalName: ssotFileName,
      now: uploadedAt,
    })
    pushRaw(ssotKey)
  } catch {
    const yyyy = String(uploadedAt.getUTCFullYear())
    const mm = String(uploadedAt.getUTCMonth() + 1).padStart(2, '0')
    const safeName = sanitizeInsuranceFileName(ssotFileName)
    const manualSeg = tsMatch ? `${tsMatch[1]}-${safeName}` : safeName
    pushRaw(
      `insurance/${gaCode}/users/${userSeg}/customer-claim-app-files/${customerId}/${requestId}/${yyyy}/${mm}/${manualSeg}`,
    )
  }

  return merged
}

/**
 * @param {{
 *   storageKey?: string,
 *   gaCode?: string | null,
 *   agentId?: string | null,
 *   customerId?: number | null,
 *   requestId?: number | null,
 *   fileName?: string | null,
 * }} context
 */
export async function readCustomerClaimAppAttachmentBuffer(context) {
  const candidates = collectCustomerClaimAppAttachmentKeyCandidates(context.storageKey, context)
  if (candidates.length === 0) {
    const err = new Error(STORAGE_FILE_READ_USER_MESSAGE)
    err.code = 'STORAGE_FILE_KEY_MISSING'
    throw err
  }

  let lastError = null
  for (const key of candidates) {
    try {
      return await consentGetBuffer(key)
    } catch (e) {
      lastError = e
      if (isR2ObjectNotFoundError(e)) {
        continue
      }
      throw e
    }
  }

  const err = new Error(STORAGE_FILE_READ_USER_MESSAGE)
  err.code = 'STORAGE_FILE_NOT_FOUND'
  if (lastError && typeof lastError === 'object') {
    err.cause = lastError
  }
  throw err
}

/**
 * @param {{
 *   storageKey?: string,
 *   source?: InsuranceClaimDownloadSource,
 *   gaCode?: string | null,
 *   agentId?: string | null,
 *   customerId?: number | null,
 *   requestId?: number | null,
 *   fileName?: string | null,
 * } | string} file
 */
export async function readInsuranceClaimDownloadBuffer(file) {
  const meta = typeof file === 'string' ? { storageKey: file } : file ?? {}
  const storageKey = String(meta.storageKey ?? '').trim()
  if (!storageKey) {
    throw new Error('storage key missing')
  }
  const source = resolveInsuranceClaimDownloadSource(storageKey, meta.source)
  if (source === 'generated') {
    return getClaimDocumentObject(storageKey)
  }
  if (source === 'claim_attachment') {
    return getClaimRequestAttachmentObject(storageKey)
  }
  return readCustomerClaimAppAttachmentBuffer({
    storageKey,
    gaCode: meta.gaCode,
    agentId: meta.agentId,
    customerId: meta.customerId,
    requestId: meta.requestId,
    fileName: meta.fileName,
  })
}
