/**
 * ONE FC 고객 등록 필드 SSOT (client customerExcelUpload 와 동일 키).
 * OpenAI column-map Phase 1B 에서 destinationField 로 사용.
 */
export const CUSTOMER_IMPORT_FIELD_KEYS = Object.freeze([
  'name',
  'gender',
  'ssn',
  'phone',
  'address',
  'height',
  'weight',
  'job',
  'isDriver',
  'carType',
  'carNumber',
  'carModel',
  'carYear',
  'renewalDate',
  'medical',
  'insuranceHistory',
  'memo',
])

/** @type {Record<string, string>} header label (trimmed) → field key */
export const CUSTOMER_IMPORT_HEADER_ALIASES = Object.freeze({
  이름: 'name',
  성명: 'name',
  고객명: 'name',
  고객성명: 'name',
  성별: 'gender',
  주민번호: 'ssn',
  휴대폰번호: 'phone',
  휴대폰: 'phone',
  핸드폰: 'phone',
  'H.P': 'phone',
  HP: 'phone',
  연락처: 'phone',
  전화번호: 'phone',
  주소: 'address',
  키: 'height',
  몸무게: 'weight',
  직업: 'job',
  운전여부: 'isDriver',
  자동차종류: 'carType',
  차번호: 'carNumber',
  자동차모델명: 'carModel',
  년식: 'carYear',
  갱신일: 'renewalDate',
  병력사항: 'medical',
  보험가입내역: 'insuranceHistory',
  메모: 'memo',
  비고: 'memo',
})

export function isKnownCustomerImportField(fieldKey) {
  return CUSTOMER_IMPORT_FIELD_KEYS.includes(fieldKey)
}

/**
 * @param {string[]} headers
 * @returns {Record<string, string>} columnIndexKey col_N → fieldKey
 */
export function suggestAliasColumnMapping(headers) {
  const mapping = {}
  headers.forEach((header, index) => {
    const raw = String(header ?? '').trim()
    if (!raw) {
      return
    }
    const normalized = raw.replace(/\s+/g, '')
    const byAlias = CUSTOMER_IMPORT_HEADER_ALIASES[raw] ?? CUSTOMER_IMPORT_HEADER_ALIASES[normalized]
    if (byAlias && isKnownCustomerImportField(byAlias)) {
      mapping[`col_${index}`] = byAlias
      return
    }
    const lower = raw.toLowerCase()
    const byKey = CUSTOMER_IMPORT_FIELD_KEYS.find((k) => k.toLowerCase() === lower)
    if (byKey) {
      mapping[`col_${index}`] = byKey
    }
  })
  return mapping
}
