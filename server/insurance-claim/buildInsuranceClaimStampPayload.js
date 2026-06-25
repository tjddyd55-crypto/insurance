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
 * 동의서 PDF — checkbox 필드는 placement checkedValue 기준으로 모두 체크되도록 값을 채운다.
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
    const checkedValues = [
      ...new Set(
        placements
          .map((placement) => placementCheckedValue(placement))
          .filter((value) => value != null && String(value).trim() !== ''),
      ),
    ]
    if (checkedValues.length === 1) {
      out[key] = checkedValues[0]
    } else if (checkedValues.length > 1) {
      out[key] = JSON.stringify(checkedValues)
    } else {
      out[key] = 'true'
    }
  }
  return out
}

export async function loadInsuranceClaimSignaturePngs(fields, signatureData) {
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
    const meta = isContractorSignatureField(field) ? contractor : insured
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
 */
export async function buildInsuranceClaimStampPayload(fields, request, documentType) {
  let values = resolveInsuranceClaimFieldValues(fields, request, { documentType })
  if (documentType === 'consent_form') {
    values = applyConsentFormCheckboxValues(fields, values)
  }
  const signaturePngByFieldKey = await loadInsuranceClaimSignaturePngs(fields, request.signatureData ?? {})
  return { values, signaturePngByFieldKey }
}
