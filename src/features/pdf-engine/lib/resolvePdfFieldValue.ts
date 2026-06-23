import type { CustomerRecord } from '../../customers/domain/types'
import {
  isCustomerPdfCarFieldKey,
  isCustomerPdfFieldKey,
  labelForCustomerPdfFieldKey,
} from '../config/customerPdfFieldOptions'
import {
  buildPdfMappingKey,
  isKnownPdfMappingKey,
  labelForPdfMappingItem,
  parsePdfMappingKey,
  pickMappedPdfFieldValue,
  type PdfFieldDataGroupId,
} from '../config/pdfFieldDataGroups'
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
    dataGroup: 'default_customer',
    fieldKey,
    customerFieldKey: fieldKey,
    customerFieldLabel: labelForCustomerPdfFieldKey(fieldKey),
    fallbackText: null,
    transformType: null,
  }
}

/** API/DB 응답 필드에서 매핑 원본(dataMapping · customerMapping)을 읽는다. */
export function readPdfFieldDataMappingFromField(
  field: PdfFieldSpec & { customerMapping?: unknown; customer_mapping?: unknown },
): PdfFieldDataMapping {
  const fromDataMapping = normalizePdfFieldDataMapping(
    field.dataMapping as Partial<PdfFieldDataMapping> | string | null | undefined,
  )
  const legacyRaw = field.customerMapping ?? field.customer_mapping ?? null
  const fromLegacy = normalizePdfFieldDataMapping(
    legacyRaw as Partial<PdfFieldDataMapping> | string | null | undefined,
  )

  if (fromDataMapping.dataSourceType === 'customer' && fromDataMapping.customerFieldKey) {
    return fromDataMapping
  }
  if (fromLegacy.dataSourceType === 'customer' && fromLegacy.customerFieldKey) {
    return fromLegacy
  }
  if (fromDataMapping.fallbackText || fromDataMapping.transformType) {
    return fromDataMapping
  }
  if (fromLegacy.fallbackText || fromLegacy.transformType) {
    return fromLegacy
  }
  return fromDataMapping
}

/** PUT 저장 payload — dataMappingClearIntent 는 DB에 저장되지 않는다. */
export type PdfFieldSavePayload = PdfFieldSpec & {
  dataMappingClearIntent?: boolean
}

/** PUT 저장 직전 — 모든 필드에 명시적 dataMapping 을 보장한다. */
export function pdfFieldSpecsForSavePayload(fields: PdfFieldSpec[]): PdfFieldSavePayload[] {
  return fields.map((field) => {
    const payload: PdfFieldSavePayload = {
      ...field,
      dataMapping: readPdfFieldDataMappingFromField(field),
    }
    if (field.dataMappingClearIntent !== true) {
      delete payload.dataMappingClearIntent
    }
    return payload
  })
}

function readDataGroupAlias(raw: Record<string, unknown>): string | null {
  const v = raw.dataGroup ?? raw.dataRole ?? raw.data_group ?? raw.data_role
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function readFieldKeyAlias(raw: Record<string, unknown>): string | null {
  const v = raw.fieldKey ?? raw.field_key
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function enrichCustomerPdfFieldMapping(input: {
  customerFieldKey: string | null
  dataGroup: PdfFieldDataGroupId | null
  fieldKey: string | null
  customerFieldLabel: string | null
}): Pick<PdfFieldDataMapping, 'dataGroup' | 'fieldKey' | 'customerFieldKey' | 'customerFieldLabel'> {
  let customerFieldKey = input.customerFieldKey
  let dataGroup = input.dataGroup
  let fieldKey = input.fieldKey

  if (customerFieldKey && (isCustomerPdfFieldKey(customerFieldKey) || isKnownPdfMappingKey(customerFieldKey))) {
    const parsed = parsePdfMappingKey(customerFieldKey)
    dataGroup = parsed.dataGroup
    fieldKey = parsed.fieldKey
    customerFieldKey = parsed.customerFieldKey
  } else if (dataGroup && dataGroup !== 'manual' && fieldKey) {
    customerFieldKey = buildPdfMappingKey(dataGroup, fieldKey)
  }

  if (!customerFieldKey || dataGroup === 'manual') {
    return {
      dataGroup: 'manual',
      fieldKey: null,
      customerFieldKey: null,
      customerFieldLabel: null,
    }
  }

  const parsed = parsePdfMappingKey(customerFieldKey)
  const resolvedGroup = (dataGroup && dataGroup !== 'manual' ? dataGroup : parsed.dataGroup) as PdfFieldDataGroupId
  const resolvedFieldKey = fieldKey ?? parsed.fieldKey
  const customerFieldLabel =
    input.customerFieldLabel ||
    (resolvedFieldKey ? labelForPdfMappingItem(resolvedGroup, resolvedFieldKey) : null) ||
    null

  return {
    dataGroup: resolvedGroup,
    fieldKey: resolvedFieldKey,
    customerFieldKey,
    customerFieldLabel,
  }
}

export function normalizePdfFieldDataMapping(
  raw: (Partial<PdfFieldDataMapping> & Record<string, unknown>) | string | null | undefined,
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
  /*
   * 저장 포맷은 camelCase 이다. 다만 서버/DB에서 레거시 snake_case JSON 이
   * 섞여 내려와도 편집 화면이 manual 로 되돌아가지 않게 같은 alias 계약을 둔다.
   */
  const dataSourceTypeRaw = raw.dataSourceType ?? raw.data_source_type
  const customerFieldKeyRaw = raw.customerFieldKey ?? raw.customer_field_key
  const customerFieldLabelRaw = raw.customerFieldLabel ?? raw.customer_field_label
  const fallbackTextRaw = raw.fallbackText ?? raw.fallback_text
  const transformTypeRaw = raw.transformType ?? raw.transform_type
  const dataGroupRaw = readDataGroupAlias(raw)
  const fieldKeyRaw = readFieldKeyAlias(raw)

  const typeRaw = dataSourceTypeRaw === 'customer' ? 'customer' : 'manual'
  let customerFieldKey =
    typeof customerFieldKeyRaw === 'string' ? customerFieldKeyRaw.trim() : null
  if (customerFieldKey === 'dob') {
    customerFieldKey = 'birthDate'
  }
  const dataGroup =
    dataGroupRaw && ['default_customer', 'contractor', 'insured', 'claim', 'payment', 'manual'].includes(dataGroupRaw)
      ? (dataGroupRaw as PdfFieldDataGroupId)
      : null
  const fieldKey = fieldKeyRaw

  const customerFieldLabel =
    typeof customerFieldLabelRaw === 'string' && customerFieldLabelRaw.trim()
      ? customerFieldLabelRaw.trim()
      : null
  const fallbackText =
    typeof fallbackTextRaw === 'string' ? fallbackTextRaw.trim().slice(0, 500) : null
  const transformType =
    typeof transformTypeRaw === 'string' && transformTypeRaw.trim()
      ? transformTypeRaw.trim().slice(0, 40)
      : null

  if (typeRaw !== 'customer') {
    return {
      dataSourceType: 'manual',
      dataGroup: 'manual',
      fieldKey: null,
      customerFieldKey: null,
      customerFieldLabel: null,
      fallbackText,
      transformType,
    }
  }

  const enriched = enrichCustomerPdfFieldMapping({
    customerFieldKey,
    dataGroup,
    fieldKey,
    customerFieldLabel,
  })

  if (!enriched.customerFieldKey) {
    return {
      dataSourceType: 'manual',
      dataGroup: 'manual',
      fieldKey: null,
      customerFieldKey: null,
      customerFieldLabel: null,
      fallbackText,
      transformType,
    }
  }

  return {
    dataSourceType: 'customer',
    ...enriched,
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

  const fromCustomer = pickMappedPdfFieldValue(input.customer ?? null, mapping.customerFieldKey)
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
      m.dataGroup === 'default_customer' &&
      m.fieldKey &&
      isCustomerPdfCarFieldKey(m.fieldKey)
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
    if (m.dataSourceType !== 'customer' || !m.customerFieldKey || !m.fieldKey || !isCustomerPdfCarFieldKey(m.fieldKey)) {
      continue
    }
    if (field.fieldType !== 'text' && field.fieldType !== 'textarea') continue
    const fk = field.fieldKey
    const manual = (out[fk] ?? '').trim()
    const fromCust = pickMappedPdfFieldValue(mergedCustomerWithCarOverlay, m.customerFieldKey)
    const next = fromCust || m.fallbackText || ''
    if (overwriteMode || !manual) {
      out[fk] = next
    }
  }
  return out
}
