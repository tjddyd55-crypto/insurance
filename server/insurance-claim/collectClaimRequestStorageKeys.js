/**
 * 청구 내역 삭제 시 storage에서 제거할 storageKey 를 수집한다.
 * selected_customer_attachment_ids(고객앱 원본)는 포함하지 않는다.
 *
 * @param {object} request
 * @returns {string[]}
 */
export function collectClaimRequestStorageKeys(request) {
  /** @type {Set<string>} */
  const keys = new Set()

  const pushKey = (raw) => {
    const key = String(raw ?? '').trim()
    if (key) {
      keys.add(key)
    }
  }

  const generated =
    request?.generatedDocumentMetadata ??
    request?.generated_document_metadata ??
    {}

  if (Array.isArray(generated.documents)) {
    for (const doc of generated.documents) {
      pushKey(doc?.storageKey)
    }
  }

  pushKey(generated.claimForm?.storageKey)
  pushKey(generated.consentForm?.storageKey)
  pushKey(generated.claim_form?.storageKey)
  pushKey(generated.consent_form?.storageKey)

  const additional =
    request?.additionalAttachmentMetadata ??
    request?.additional_attachment_metadata ??
    []
  if (Array.isArray(additional)) {
    for (const item of additional) {
      pushKey(item?.storageKey)
    }
  }

  const signature = request?.signatureData ?? request?.signature_data ?? {}
  pushKey(signature.insuredSignature?.storageKey)
  pushKey(signature.contractorSignature?.storageKey)

  return [...keys]
}
