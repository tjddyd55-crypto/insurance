import {
  consentGetBuffer,
  consentPutObject,
  r2DeleteStorageObjectOrThrow,
} from '../../lib/consentStorage.js'
import {
  assertInsuranceStorageKeyPrefix,
  buildInsuranceClaimRequestGeneratedKey,
  buildInsuranceCompanyFormKey,
  isInsuranceClaimRequestGeneratedKey,
} from '../../storage/insuranceStorageKeys.js'

/**
 * 보험회사 양식 PDF (관리자 업로드).
 *
 * @param {{ companyId: number, documentType: string, fileName?: string }} input
 */
export function buildClaimDocumentStorageKey({ companyId, documentType, fileName }) {
  return buildInsuranceCompanyFormKey({
    companyId,
    documentType,
    fileName: fileName ?? `${String(documentType ?? 'document').trim() || 'document'}.pdf`,
  })
}

/**
 * 청구 생성 PDF (청구별 generated).
 *
 * @param {{ userId: string | number, claimRequestId: number | string, documentType: string, consentTarget?: string | null }} input
 */
export function buildClaimRequestGeneratedDocumentStorageKey({
  userId,
  claimRequestId,
  documentType,
  consentTarget = null,
}) {
  return buildInsuranceClaimRequestGeneratedKey({
    userId,
    claimRequestId,
    documentType,
    consentTarget,
  })
}

export function putClaimDocumentObject(key, body) {
  assertInsuranceStorageKeyPrefix(key)
  return consentPutObject(key, body, 'application/pdf')
}

export function getClaimDocumentObject(key) {
  return consentGetBuffer(key)
}

export function deleteClaimDocumentObject(key) {
  return r2DeleteStorageObjectOrThrow(key)
}

export function isGeneratedClaimDocumentKey(storageKey) {
  return isInsuranceClaimRequestGeneratedKey(storageKey)
}
