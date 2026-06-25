/**
 * 보험청구 동의서(consent_form) 생성 규칙 — 청구서(claim_form)와 분리.
 */

/**
 * @param {object} request
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateConsentFormSignatures(request) {
  const signatureData = request?.signatureData ?? {}
  const insuredKey = String(signatureData.insuredSignature?.storageKey ?? '').trim()
  if (!insuredKey) {
    return { ok: false, message: '피보험자 서명이 필요합니다.' }
  }

  if (request?.contractorSameAsInsured === false) {
    const contractorKey = String(signatureData.contractorSignature?.storageKey ?? '').trim()
    if (!contractorKey) {
      return { ok: false, message: '계약자 서명이 필요합니다.' }
    }
  }

  return { ok: true }
}

/**
 * @param {object} request
 * @returns {Array<{ consentTarget: 'insured' | 'contractor', label: string }>}
 */
export function resolveConsentFormTargets(request) {
  if (request?.contractorSameAsInsured !== false) {
    return [{ consentTarget: 'insured', label: '동의서' }]
  }

  return [
    { consentTarget: 'insured', label: '피보험자 동의서' },
    { consentTarget: 'contractor', label: '계약자 동의서' },
  ]
}

/**
 * @param {'claim_form' | 'consent_form'} type
 * @param {string} label
 * @param {string} storageKey
 * @param {'insured' | 'contractor' | null} [consentTarget]
 */
export function buildGeneratedDocumentMetadataEntry(type, label, storageKey, consentTarget = null) {
  /** @type {Record<string, unknown>} */
  const entry = {
    type,
    documentType: type,
    label,
    storageKey,
    contentType: 'application/pdf',
  }
  if (type === 'consent_form' && consentTarget) {
    entry.consentTarget = consentTarget
  }
  return entry
}
