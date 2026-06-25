import { placementCheckedValue } from '../pdf-engine/renderer/checkboxStampLogic.js'
import { resolveInsuranceClaimFieldValues } from './claimFieldValueResolver.js'
import { getClaimRequestAttachmentObject } from './storage/claimRequestAttachmentStorage.js'

function isContractorSignatureField(field) {
  const key = String(field.fieldKey ?? '')
  const mapping = field.dataMapping ?? {}
  if (mapping.useSecondaryCustomer === true) {
    return true
  }
  return /contractor|secondary|계약자/i.test(key)
}

/**
 * 동의서 PDF — checkbox 필드는 consent_form 생성 시 항상 전체 체크.
 * checkedValue 유무와 관계없이 모든 placement를 checked로 만든다.
 */
export function applyConsentFormCheckboxValues(fields, values) {
  const out = { ...values }
  for (const field of fields) {
    if (field.fieldType !== 'checkbox') {
      continue
    }
    const key = String(field.fieldKey ?? '')
    if (!key) {
      continue
    }
    const placements = Array.isArray(field.placements) ? field.placements : []
    if (placements.length === 0) {
      out[key] = 'true'
      continue
    }
    const checkedValues = [
      ...new Set(
        placements.map((placement) => {
          const value = placementCheckedValue(placement)
          return value != null && String(value).trim() !== '' ? String(value).trim() : 'true'
        }),
      ),
    ]
    if (checkedValues.length === 1) {
      out[key] = checkedValues[0]
    } else {
      out[key] = JSON.stringify(checkedValues)
    }
  }
  return out
}

export async function loadInsuranceClaimSignaturePngs(fields, signatureData, consentTarget = null) {
  /** @type {Record<string, Buffer>} */
  const signaturePngByFieldKey = {}
  const insured = signatureData?.insuredSignature ?? null
  const contractor = signatureData?.contractorSignature ?? null

  for (const field of fields) {
    if (field.fieldType !== 'signature') {
      continue
    }
    const fieldKey = String(field.fieldKey ?? '').trim()
    if (!fieldKey) {
      continue
    }
    let meta
    if (consentTarget === 'contractor') {
      meta = contractor
    } else if (consentTarget === 'insured') {
      meta = insured
    } else {
      meta = isContractorSignatureField(field) ? contractor : insured
    }
    const storageKey = String(meta?.storageKey ?? '').trim()
    if (!storageKey) {
      continue
    }
    try {
      const buf = await getClaimRequestAttachmentObject(storageKey)
      if (buf?.length) {
        signaturePngByFieldKey[fieldKey] = Buffer.from(buf)
      }
    } catch {
      // 누락된 서명 파일은 스킵 — 나머지 필드는 계속 스탬프
    }
  }

  return signaturePngByFieldKey
}

/**
 * @param {import('../pdf-engine/schema/fieldSpec.js').FieldSpec[]} fields
 * @param {object} request
 * @param {'claim_form' | 'consent_form'} documentType
 * @param {{ consentTarget?: 'insured' | 'contractor' | null }} [options]
 */
export async function buildInsuranceClaimStampPayload(fields, request, documentType, options = {}) {
  const consentTarget = options.consentTarget ?? null
  let values = resolveInsuranceClaimFieldValues(fields, request, { documentType, consentTarget })
  if (documentType === 'consent_form') {
    values = applyConsentFormCheckboxValues(fields, values)
  }
  const signaturePngByFieldKey = await loadInsuranceClaimSignaturePngs(
    fields,
    request.signatureData ?? {},
    documentType === 'consent_form' ? consentTarget : null,
  )
  return { values, signaturePngByFieldKey }
}
