/**
 * PDF 좌표 필드 ↔ 고객 데이터 매핑 (템플릿에 저장되는 메타만).
 * 실제 고객 값은 발급/미리보기 시점에 resolve 한다.
 */

import { isAllowedCustomerPdfFieldKey } from '../mapping/customerPdfFieldKeys.js'

/** @typedef {'manual' | 'customer'} PdfFieldDataSourceType */

/**
 * @typedef {{
 *   dataSourceType: PdfFieldDataSourceType,
 *   customerFieldKey: string | null,
 *   customerFieldLabel: string | null,
 *   fallbackText: string | null,
 *   transformType: string | null,
 * }} PdfFieldDataMapping
 */

const LEGACY_MAPPING_KEYS = Object.freeze({
  name: 'name',
  phone: 'phone',
  dob: 'birthDate',
  address: 'address',
})

export const DEFAULT_FIELD_DATA_MAPPING = Object.freeze({
  dataSourceType: 'manual',
  customerFieldKey: null,
  customerFieldLabel: null,
  fallbackText: null,
  transformType: null,
})

/**
 * @returns {PdfFieldDataMapping}
 */
export function defaultFieldDataMapping() {
  return { ...DEFAULT_FIELD_DATA_MAPPING }
}

/**
 * DB customer_mapping TEXT → 도메인 객체.
 * - JSON 객체
 * - 레거시 단일 키: name | phone | dob | address
 *
 * @param {unknown} raw
 * @returns {PdfFieldDataMapping}
 */
export function parseFieldDataMapping(raw) {
  if (raw == null || raw === '') {
    return defaultFieldDataMapping()
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return normalizeFieldDataMapping(raw)
  }

  const str = String(raw).trim()
  if (!str) {
    return defaultFieldDataMapping()
  }

  if (str.startsWith('{')) {
    try {
      const parsed = JSON.parse(str)
      if (parsed && typeof parsed === 'object') {
        return normalizeFieldDataMapping(parsed)
      }
    } catch {
      return defaultFieldDataMapping()
    }
  }

  const legacyKey = LEGACY_MAPPING_KEYS[str]
  if (legacyKey) {
    return {
      dataSourceType: 'customer',
      customerFieldKey: legacyKey,
      customerFieldLabel: null,
      fallbackText: null,
      transformType: null,
    }
  }

  if (isAllowedCustomerPdfFieldKey(str)) {
    return {
      dataSourceType: 'customer',
      customerFieldKey: str,
      customerFieldLabel: null,
      fallbackText: null,
      transformType: null,
    }
  }

  return defaultFieldDataMapping()
}

/**
 * @param {unknown} raw
 * @returns {PdfFieldDataMapping}
 */
export function normalizeFieldDataMapping(raw) {
  const src = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {}
  /*
   * 저장 포맷은 camelCase 이지만, 운영 DB에는 초기 실험 버전에서 만든
   * snake_case JSON 이 남아 있을 수 있다. reload/replace 저장 시 이 값을
   * manual 로 오판하면 고객 데이터 매핑이 "시간이 지나 풀리는" 현상이 된다.
   */
  const dataSourceTypeRaw = src.dataSourceType ?? src.data_source_type
  const customerFieldKeyRaw = src.customerFieldKey ?? src.customer_field_key
  const customerFieldLabelRaw = src.customerFieldLabel ?? src.customer_field_label
  const fallbackTextRaw = src.fallbackText ?? src.fallback_text
  const transformTypeRaw = src.transformType ?? src.transform_type

  const typeRaw = typeof dataSourceTypeRaw === 'string' ? dataSourceTypeRaw.trim().toLowerCase() : ''
  const dataSourceType = typeRaw === 'customer' ? 'customer' : 'manual'

  let customerFieldKey =
    typeof customerFieldKeyRaw === 'string' ? customerFieldKeyRaw.trim() : null
  if (customerFieldKey === 'dob') {
    customerFieldKey = 'birthDate'
  }
  if (customerFieldKey && !isAllowedCustomerPdfFieldKey(customerFieldKey)) {
    customerFieldKey = null
  }

  const customerFieldLabel =
    typeof customerFieldLabelRaw === 'string' && customerFieldLabelRaw.trim()
      ? customerFieldLabelRaw.trim().slice(0, 80)
      : null

  const fallbackText =
    typeof fallbackTextRaw === 'string' ? fallbackTextRaw.trim().slice(0, 500) : null

  const transformType =
    typeof transformTypeRaw === 'string' && transformTypeRaw.trim()
      ? transformTypeRaw.trim().slice(0, 40)
      : null

  if (dataSourceType !== 'customer') {
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
    customerFieldKey: customerFieldKey || null,
    customerFieldLabel,
    fallbackText,
    transformType,
  }
}

/**
 * @param {PdfFieldDataMapping | null | undefined} mapping
 * @returns {string | null}
 */
export function serializeFieldDataMapping(mapping) {
  const m = normalizeFieldDataMapping(mapping ?? defaultFieldDataMapping())
  if (m.dataSourceType === 'manual' && !m.fallbackText && !m.transformType) {
    return null
  }
  return JSON.stringify(m)
}

/**
 * DB/도메인 매핑이 "고객 데이터 + 필드키" 를 갖는지 판별한다.
 *
 * @param {unknown} mapping
 * @returns {boolean}
 */
export function hasCustomerFieldMapping(mapping) {
  const m =
    mapping != null && typeof mapping === 'object' && !Array.isArray(mapping)
      ? normalizeFieldDataMapping(mapping)
      : parseFieldDataMapping(mapping)
  return m.dataSourceType === 'customer' && Boolean(m.customerFieldKey)
}

/**
 * PUT fields payload 에서 "직접 입력으로 명시 해제" intent 를 읽는다.
 * DB/normalizeFieldSpec 에는 저장하지 않는다.
 *
 * @param {unknown} rawField
 * @returns {boolean}
 */
export function hasDataMappingClearIntent(rawField) {
  if (!rawField || typeof rawField !== 'object') {
    return false
  }
  const src = /** @type {Record<string, unknown>} */ (rawField)
  if (src.dataMappingClearIntent === true) {
    return true
  }
  if (src.__dataMappingAction === 'clear') {
    return true
  }
  return false
}

/**
 * replace-all 저장 직전 — incoming manual/default payload 가 기존 customer_mapping 을
 * 지우지 않도록 병합한다. placements 등 나머지 필드 속성은 normalizedFields 를 그대로 쓴다.
 *
 * @param {{
 *   existingRows: Array<{ field_key: string, customer_mapping: unknown }>,
 *   rawFields: unknown,
 *   normalizedFields: import('./fieldSpec.js').FieldSpec[],
 * }} input
 * @returns {{
 *   mergedFields: import('./fieldSpec.js').FieldSpec[],
 *   preservedCount: number,
 *   clearedCount: number,
 *   incomingCustomerCount: number,
 * }}
 */
export function mergePdfFieldCustomerMappings(input) {
  const { existingRows, rawFields, normalizedFields } = input

  /** @type {Map<string, PdfFieldDataMapping>} */
  const existingByKey = new Map()
  for (const row of existingRows) {
    if (!row || typeof row.field_key !== 'string') {
      continue
    }
    existingByKey.set(row.field_key, parseFieldDataMapping(row.customer_mapping))
  }

  /** @type {Map<string, Record<string, unknown>>} */
  const rawByKey = new Map()
  if (Array.isArray(rawFields)) {
    for (const raw of rawFields) {
      if (!raw || typeof raw !== 'object') {
        continue
      }
      const src = /** @type {Record<string, unknown>} */ (raw)
      const fieldKey = typeof src.fieldKey === 'string' ? src.fieldKey.trim() : ''
      if (!fieldKey) {
        continue
      }
      rawByKey.set(fieldKey, src)
    }
  }

  let preservedCount = 0
  let clearedCount = 0
  let incomingCustomerCount = 0

  const mergedFields = normalizedFields.map((field) => {
    const existing = existingByKey.get(field.fieldKey) ?? null
    const raw = rawByKey.get(field.fieldKey) ?? null
    const clearIntent = raw ? hasDataMappingClearIntent(raw) : false
    const incoming = field.dataMapping

    if (hasCustomerFieldMapping(incoming)) {
      incomingCustomerCount += 1
      return field
    }

    if (clearIntent && hasCustomerFieldMapping(existing)) {
      clearedCount += 1
      return field
    }

    if (hasCustomerFieldMapping(existing) && !hasCustomerFieldMapping(incoming)) {
      preservedCount += 1
      return {
        ...field,
        dataMapping: existing,
      }
    }

    return field
  })

  return { mergedFields, preservedCount, clearedCount, incomingCustomerCount }
}
