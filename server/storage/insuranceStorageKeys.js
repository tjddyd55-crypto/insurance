/**
 * 보험청구·팩스·문자 등 보험 도메인 R2 object key SSOT.
 * 버킷: platform-assets (consentStorage 가 bucket 분리)
 * 신규 key 는 반드시 `insurance/` 로 시작한다.
 */
import { randomUUID } from 'node:crypto'
import {
  INSURANCE_STORAGE_BUCKET,
  sanitizeInsuranceFileName,
  sanitizeInsurancePathSegment,
  sanitizeInsuranceUserIdSegment,
  stripInsuranceStorageKey,
} from '../lib/insuranceStorageLayout.js'

export { INSURANCE_STORAGE_BUCKET }

export const INSURANCE_STORAGE_PREFIX = 'insurance'

export const INSURANCE_CLAIM_REQUEST_CATEGORY = Object.freeze({
  GENERATED: 'generated',
  ATTACHMENTS: 'attachments',
  MERGED: 'merged',
  FAX: 'fax',
  SIGNATURES: 'signatures',
})

export const INSURANCE_FAX_JOB_CATEGORY = Object.freeze({
  INPUT: 'input',
  OUTPUT: 'output',
  LOGS: 'logs',
})

export const INSURANCE_MESSAGE_CATEGORY = Object.freeze({
  ATTACHMENTS: 'attachments',
  GENERATED: 'generated',
})

const LEGACY_GENERATED_PREFIX = 'insurance-claim-documents/'
const LEGACY_CLAIM_REQUEST_PREFIX = 'insurance-claim-requests/'

/**
 * @param {unknown} value
 */
export function sanitizeInsuranceStorageFileName(value) {
  return sanitizeInsuranceFileName(value)
}

/**
 * @param {unknown} value
 */
export function sanitizeInsuranceStorageUserId(value) {
  return sanitizeInsuranceUserIdSegment(value)
}

/**
 * @param {string} key
 */
export function assertInsuranceStorageKeyPrefix(key) {
  const normalized = stripInsuranceStorageKey(key)
  if (!normalized.startsWith(`${INSURANCE_STORAGE_PREFIX}/`)) {
    throw new Error('Insurance files must be stored under insurance/')
  }
  if (normalized.includes('..')) {
    throw new Error('Invalid insurance storage key')
  }
  return normalized
}

/**
 * @param {object} params
 * @param {string | number} params.userId
 * @param {string | number} params.claimRequestId
 * @param {string} params.category
 * @param {string} params.fileName
 */
export function buildInsuranceClaimRequestKey({ userId, claimRequestId, category, fileName }) {
  const userSeg = sanitizeInsuranceStorageUserId(userId)
  const claimSeg = sanitizeInsurancePathSegment(claimRequestId)
  const categorySeg = sanitizeInsurancePathSegment(category, 32)
  const safeName = sanitizeInsuranceStorageFileName(fileName)
  if (!userSeg || userSeg === '_' || !claimSeg || claimSeg === '_' || !categorySeg || categorySeg === '_') {
    throw new Error('userId, claimRequestId and category are required')
  }
  if (!safeName) {
    throw new Error('fileName is required')
  }
  return [
    INSURANCE_STORAGE_PREFIX,
    'claim-requests',
    userSeg,
    claimSeg,
    categorySeg,
    safeName,
  ].join('/')
}

/**
 * @param {object} params
 * @param {string | number} params.userId
 * @param {string | number} params.claimRequestId
 * @param {string} params.fileName
 */
export function buildInsuranceClaimRequestAttachmentKey({ userId, claimRequestId, fileName }) {
  const uniqueName = `${randomUUID()}-${sanitizeInsuranceStorageFileName(fileName)}`
  return buildInsuranceClaimRequestKey({
    userId,
    claimRequestId,
    category: INSURANCE_CLAIM_REQUEST_CATEGORY.ATTACHMENTS,
    fileName: uniqueName,
  })
}

/**
 * @param {object} params
 * @param {string | number} params.userId
 * @param {string | number} params.claimRequestId
 * @param {'insured' | 'contractor'} params.role
 * @param {string} [params.fileName]
 */
export function buildInsuranceClaimRequestSignatureKey({ userId, claimRequestId, role, fileName }) {
  const safeRole = role === 'contractor' ? 'contractor' : 'insured'
  const uniqueName = `${safeRole}-${randomUUID()}-${sanitizeInsuranceStorageFileName(fileName ?? 'signature.png')}`
  return buildInsuranceClaimRequestKey({
    userId,
    claimRequestId,
    category: INSURANCE_CLAIM_REQUEST_CATEGORY.SIGNATURES,
    fileName: uniqueName,
  })
}

/**
 * @param {string} documentType
 * @param {string | null | undefined} [consentTarget]
 */
export function buildInsuranceClaimRequestGeneratedFileName(documentType, consentTarget = null) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const type = String(documentType ?? 'document').trim().toLowerCase()
  if (type === 'claim_form' || type.includes('claim_form')) {
    return `claim-form-${date}-${randomUUID().slice(0, 8)}.pdf`
  }
  if (type === 'consent_form' || type.includes('consent_form')) {
    const target = consentTarget === 'contractor' ? 'contractor' : 'insured'
    return `consent-form-${target}-${date}-${randomUUID().slice(0, 8)}.pdf`
  }
  const safeType = sanitizeInsurancePathSegment(type, 48)
  return `${safeType}-${date}-${randomUUID().slice(0, 8)}.pdf`
}

/**
 * @param {object} params
 * @param {string | number} params.userId
 * @param {string | number} params.claimRequestId
 * @param {string} params.documentType
 * @param {string | null | undefined} [params.consentTarget]
 */
export function buildInsuranceClaimRequestGeneratedKey({
  userId,
  claimRequestId,
  documentType,
  consentTarget = null,
}) {
  return buildInsuranceClaimRequestKey({
    userId,
    claimRequestId,
    category: INSURANCE_CLAIM_REQUEST_CATEGORY.GENERATED,
    fileName: buildInsuranceClaimRequestGeneratedFileName(documentType, consentTarget),
  })
}

/**
 * @param {object} params
 * @param {string | number} params.companyId
 * @param {string} params.documentType
 * @param {string} [params.fileName]
 */
export function buildInsuranceCompanyFormKey({ companyId, documentType, fileName }) {
  const companySeg = sanitizeInsurancePathSegment(`company-${companyId}`)
  const formType = sanitizeInsurancePathSegment(documentType, 48)
  const safeName =
    sanitizeInsuranceStorageFileName(fileName) ||
    `${formType}-${randomUUID().slice(0, 8)}.pdf`
  if (!companySeg || companySeg === '_' || !formType || formType === '_') {
    throw new Error('companyId and documentType are required')
  }
  return [INSURANCE_STORAGE_PREFIX, 'forms', companySeg, formType, safeName].join('/')
}

/**
 * @param {object} params
 * @param {string | number} params.userId
 * @param {string | number} params.faxJobId
 * @param {string} params.category
 * @param {string} params.fileName
 */
export function buildInsuranceFaxJobKey({ userId, faxJobId, category, fileName }) {
  const userSeg = sanitizeInsuranceStorageUserId(userId)
  const jobSeg = sanitizeInsurancePathSegment(faxJobId)
  const categorySeg = sanitizeInsurancePathSegment(category, 32)
  const safeName = sanitizeInsuranceStorageFileName(fileName)
  if (!userSeg || userSeg === '_' || !jobSeg || jobSeg === '_' || !categorySeg || categorySeg === '_') {
    throw new Error('userId, faxJobId and category are required')
  }
  return [INSURANCE_STORAGE_PREFIX, 'fax-jobs', userSeg, jobSeg, categorySeg, safeName].join('/')
}

/**
 * @param {object} params
 * @param {string | number} params.userId
 * @param {string | number} params.messageBatchId
 * @param {string} params.category
 * @param {string} params.fileName
 */
export function buildInsuranceMessageKey({ userId, messageBatchId, category, fileName }) {
  const userSeg = sanitizeInsuranceStorageUserId(userId)
  const batchSeg = sanitizeInsurancePathSegment(messageBatchId)
  const categorySeg = sanitizeInsurancePathSegment(category, 32)
  const safeName = sanitizeInsuranceStorageFileName(fileName)
  if (!userSeg || userSeg === '_' || !batchSeg || batchSeg === '_' || !categorySeg || categorySeg === '_') {
    throw new Error('userId, messageBatchId and category are required')
  }
  return [INSURANCE_STORAGE_PREFIX, 'messages', userSeg, batchSeg, categorySeg, safeName].join('/')
}

/**
 * @param {object} params
 * @param {string | number} [params.noticeId]
 * @param {string | number} [params.userId]
 * @param {string} params.fileName
 */
export function buildInsuranceAdminNoticeImageKey({ noticeId, userId, fileName }) {
  const safeName = `${randomUUID()}-${sanitizeInsuranceStorageFileName(fileName)}`
  if (noticeId != null && String(noticeId).trim() !== '') {
    const noticeSeg = sanitizeInsurancePathSegment(noticeId)
    if (!noticeSeg || noticeSeg === '_') {
      throw new Error('noticeId is required')
    }
    return [INSURANCE_STORAGE_PREFIX, 'admin-notices', noticeSeg, safeName].join('/')
  }
  const userSeg = sanitizeInsuranceStorageUserId(userId ?? 'system')
  return [INSURANCE_STORAGE_PREFIX, 'admin-notices', 'temp', userSeg, safeName].join('/')
}

/**
 * @param {string | null | undefined} storageKey
 */
export function isLegacyInsuranceClaimGeneratedKey(storageKey) {
  return String(storageKey ?? '').startsWith(LEGACY_GENERATED_PREFIX)
}

/**
 * @param {string | null | undefined} storageKey
 */
export function isInsuranceClaimRequestGeneratedKey(storageKey) {
  const key = stripInsuranceStorageKey(storageKey)
  if (isLegacyInsuranceClaimGeneratedKey(key)) {
    return true
  }
  return new RegExp(
    `^${INSURANCE_STORAGE_PREFIX}/claim-requests/[^/]+/[^/]+/${INSURANCE_CLAIM_REQUEST_CATEGORY.GENERATED}/`,
  ).test(key)
}

/**
 * @param {string | null | undefined} storageKey
 */
export function isInsuranceClaimRequestAttachmentKey(storageKey) {
  const key = stripInsuranceStorageKey(storageKey)
  if (key.startsWith(LEGACY_CLAIM_REQUEST_PREFIX)) {
    return true
  }
  return new RegExp(
    `^${INSURANCE_STORAGE_PREFIX}/claim-requests/[^/]+/[^/]+/(?:${[
      INSURANCE_CLAIM_REQUEST_CATEGORY.ATTACHMENTS,
      INSURANCE_CLAIM_REQUEST_CATEGORY.SIGNATURES,
      INSURANCE_CLAIM_REQUEST_CATEGORY.MERGED,
      INSURANCE_CLAIM_REQUEST_CATEGORY.FAX,
    ].join('|')})/`,
  ).test(key)
}

/**
 * 청구 삭제 시 prefix 기반 정리용 (신규 SSOT 경로).
 *
 * @param {object} params
 * @param {string | number} params.userId
 * @param {string | number} params.claimRequestId
 */
export function buildInsuranceClaimRequestStoragePrefix({ userId, claimRequestId }) {
  const userSeg = sanitizeInsuranceStorageUserId(userId)
  const claimSeg = sanitizeInsurancePathSegment(claimRequestId)
  return `${INSURANCE_STORAGE_PREFIX}/claim-requests/${userSeg}/${claimSeg}/`
}
