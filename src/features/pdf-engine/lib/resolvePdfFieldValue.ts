import type { CustomerRecord } from '../../customers/domain/types'
import {
  isCustomerPdfCarFieldKey,
  isCustomerPdfFieldKey,
  labelForCustomerPdfFieldKey,
  pickCustomerPdfFieldValue,
} from '../config/customerPdfFieldOptions'
import type { PdfFieldDataMapping, PdfFieldSpec } from '../types'
import { DEFAULT_PDF_FIELD_DATA_MAPPING } from '../types'

/** 서버 `fieldDataMapping.js` LEGACY_MAPPING_KEYS 와 동기화 */
const LEGACY_CUSTOMER_MAPPING_STRINGS: Record<string, string> = {
  name: 'name',
  phone: 'phone',
  dob: 'birthDate',
  address: 'address',
}

function legacyCustomerMappingFromString(str: string): PdfFieldDataMapping | null {
  const legacyKey = LEGACY_CUSTOMER_MAPPING_STRINGS[str]
  const fieldKey = legacyKey ?? (isCustomerPdfFieldKey(str) ? str : null)
  if (!fieldKey) {
    return null
  }
  return {
    dataSourceType: 'customer',
    customerFieldKey: fieldKey,
    customerFieldLabel: labelForCustomerPdfFieldKey(fieldKey),
    fallbackText: null,
    transformType: null,
  }
}

/** API/DB 응답 필드에서 매핑 원본(dataMapping · customerMapping)을 읽는다. */
export function readPdfFieldDataMappingFromField(
  field: PdfFieldSpec & { customerMapping?: unknown },
): PdfFieldDataMapping {
  const raw = field.dataMapping ?? field.customerMapping ?? null
  return normalizePdfFieldDataMapping(raw as Partial<PdfFieldDataMapping> | string | null | undefined)
}

/** PUT 저장 직전 — 모든 필드에 명시적 dataMapping 을 보장한다. */
export function pdfFieldSpecsForSavePayload(fields: PdfFieldSpec[]): PdfFieldSpec[] {
  return fields.map((field) => ({
    ...field,
    dataMapping: readPdfFieldDataMappingFromField(field),
  }))
}

export function normalizePdfFieldDataMapping(
  raw: Partial<PdfFieldDataMapping> | string | null | undefined,
): PdfFieldDataMapping {
  if (raw == null || raw === '') {
    return { ...DEFAULT_PDF_FIELD_DATA_MAPPING }
  }
  if (typeof raw === 'string') {
    const str = raw.trim()
    if (!str) {
      return { ...DEFAULT_PDF_FIELD_DATA_MAPPING }
    }
    if (str.startsWith('{')) {
      try {
        const parsed = JSON.parse(str) as Partial<PdfFieldDataMapping>
        if (parsed && typeof parsed === 'object') {
          return normalizePdfFieldDataMapping(parsed)
        }
      } catch {
        const legacy = legacyCustomerMappingFromString(str)
        return legacy ?? { ...DEFAULT_PDF_FIELD_DATA_MAPPING }
      }
    }
    const legacy = legacyCustomerMappingFromString(str)
    if (legacy) {
      return legacy
    }
    return { ...DEFAULT_PDF_FIELD_DATA_MAPPING }
  }
  if (typeof raw !== 'object') {
    return { ...DEFAULT_PDF_FIELD_DATA_MAPPING }
  }
  const typeRaw = raw.dataSourceType === 'customer' ? 'customer' : 'manual'
  let customerFieldKey =
    typeof raw.customerFieldKey === 'string' ? raw.customerFieldKey.trim() : null
  if (customerFieldKey === 'dob') {
    customerFieldKey = 'birthDate'
  }
  if (customerFieldKey && !isCustomerPdfFieldKey(customerFieldKey)) {
    customerFieldKey = null
  }
  const customerFieldLabel =
    typeof raw.customerFieldLabel === 'string' && raw.customerFieldLabel.trim()
      ? raw.customerFieldLabel.trim()
      : customerFieldKey
        ? labelForCustomerPdfFieldKey(customerFieldKey)
        : null
  const fallbackText =
    typeof raw.fallbackText === 'string' ? raw.fallbackText.trim().slice(0, 500) : null
  const transformType =
    typeof raw.transformType === 'string' && raw.transformType.trim()
      ? raw.transformType.trim().slice(0, 40)
      : null

  if (typeRaw !== 'customer') {
    return {
      dataSourceType: 'manual',
      customerFieldKey: null,
      customerFieldLabel: null,
      fallbackText,
      transformType,
    }
  }
  return {
    dataSourceType: 'customer',
    customerFieldKey,
    customerFieldLabel,
    fallbackText,
    transformType,
  }
}

export function resolvePdfFieldValue(input: {
  field: Pick<PdfFieldSpec, 'dataMapping'>
  manualValue?: string | null
  customer?: CustomerRecord | null
  overwriteMode?: boolean
}): string {
  const manual = (input.manualValue ?? '').trim()
  const mapping = normalizePdfFieldDataMapping(input.field.dataMapping)

  if (mapping.dataSourceType !== 'customer' || !mapping.customerFieldKey) {
    return manual
  }

  const fromCustomer = pickCustomerPdfFieldValue(input.customer as CustomerRecord, mapping.customerFieldKey)
  const resolved = fromCustomer || mapping.fallbackText || ''

  if (input.overwriteMode) {
    return resolved
  }
  if (manual) {
    return manual
  }
  return resolved
}

export function applyCustomerDataToPdfValues(
  fields: PdfFieldSpec[],
  values: Record<string, string>,
  customer: CustomerRecord | null,
  opts?: { overwriteMode?: boolean; skipCarMappedFields?: boolean },
): Record<string, string> {
  const overwriteMode = opts?.overwriteMode === true
  const skipCarMappedFields = opts?.skipCarMappedFields === true
  const out = { ...values }
  for (const field of fields) {
    const m = normalizePdfFieldDataMapping(field.dataMapping)
    if (
      skipCarMappedFields &&
      m.dataSourceType === 'customer' &&
      m.customerFieldKey &&
      isCustomerPdfCarFieldKey(m.customerFieldKey)
    ) {
      continue
    }
    const key = field.fieldKey
    const manual = (out[key] ?? '').trim()
    const next = resolvePdfFieldValue({
      field,
      manualValue: manual,
      customer,
      overwriteMode,
    })
    if (overwriteMode || !manual) {
      out[key] = next
    }
  }
  return out
}

/** 차량 적용 시 — 차량 매핑 필드만 갱신한다(수동 매핑·일반 고객 필드는 유지). */
export function overwriteCarMappedPdfValuesFromCustomer(
  fields: PdfFieldSpec[],
  values: Record<string, string>,
  mergedCustomerWithCarOverlay: CustomerRecord,
  opts?: { overwriteMode?: boolean },
): Record<string, string> {
  const overwriteMode = opts?.overwriteMode === true
  const out = { ...values }
  for (const field of fields) {
    const m = normalizePdfFieldDataMapping(field.dataMapping)
    if (m.dataSourceType !== 'customer' || !m.customerFieldKey || !isCustomerPdfCarFieldKey(m.customerFieldKey)) {
      continue
    }
    if (field.fieldType !== 'text' && field.fieldType !== 'textarea') continue
    const fk = field.fieldKey
    const manual = (out[fk] ?? '').trim()
    const fromCust = pickCustomerPdfFieldValue(mergedCustomerWithCarOverlay, m.customerFieldKey)
    const next = fromCust || m.fallbackText || ''
    if (overwriteMode || !manual) {
      out[fk] = next
    }
  }
  return out
}
