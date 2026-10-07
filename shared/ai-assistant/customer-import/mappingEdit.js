import { CUSTOMER_IMPORT_FIELD_KEYS } from './fieldDictionary.js'

/** 사용자가 컬럼을 제외할 때 사용하는 sentinel (DB/고객 필드 아님) */
export const CUSTOMER_IMPORT_MAPPING_IGNORE = '__IGNORE__'

const DESTINATION_ALIASES = Object.freeze({
  제외: CUSTOMER_IMPORT_MAPPING_IGNORE,
  무시: CUSTOMER_IMPORT_MAPPING_IGNORE,
  skip: CUSTOMER_IMPORT_MAPPING_IGNORE,
  이름: 'name',
  고객명: 'name',
  성명: 'name',
  성별: 'gender',
  주민번호: 'ssn',
  휴대폰: 'phone',
  전화: 'phone',
  핸드폰: 'phone',
  주소: 'address',
  메모: 'memo',
  비고: 'memo',
  회사: 'memo',
  키: 'height',
  몸무게: 'weight',
  직업: 'job',
})

export const CUSTOMER_IMPORT_FIELD_LABELS_KO = Object.freeze({
  name: '고객명',
  gender: '성별',
  ssn: '주민번호',
  phone: '휴대전화',
  address: '주소',
  height: '키',
  weight: '몸무게',
  job: '직업',
  isDriver: '운전여부',
  carType: '자동차종류',
  carNumber: '차번호',
  carModel: '자동차모델명',
  carYear: '년식',
  renewalDate: '갱신일',
  medical: '병력사항',
  insuranceHistory: '보험가입내역',
  memo: '메모',
})

/**
 * @param {string} token
 * @returns {string|null}
 */
export function resolveDestinationFromUserToken(token) {
  const raw = String(token ?? '').trim()
  if (!raw) {
    return null
  }
  const normalized = raw.replace(/\s+/g, '')
  if (DESTINATION_ALIASES[raw] || DESTINATION_ALIASES[normalized]) {
    return DESTINATION_ALIASES[raw] ?? DESTINATION_ALIASES[normalized]
  }
  const lower = raw.toLowerCase()
  if (CUSTOMER_IMPORT_FIELD_KEYS.includes(lower)) {
    return lower
  }
  return null
}

/**
 * @param {Record<string, string>} columnMapping
 * @param {string[]} headers
 */
export function validateUserColumnMapping(columnMapping, headers) {
  if (!columnMapping || typeof columnMapping !== 'object') {
    throw Object.assign(new Error('INVALID_MAPPING'), { code: 'INVALID_MAPPING' })
  }
  const headerCount = headers.length
  for (const [key, value] of Object.entries(columnMapping)) {
    if (!/^col_\d+$/.test(key)) {
      throw Object.assign(new Error('INVALID_MAPPING_KEY'), { code: 'INVALID_MAPPING_KEY' })
    }
    const index = Number(key.slice(4))
    if (!Number.isInteger(index) || index < 0 || index >= headerCount) {
      throw Object.assign(new Error('INVALID_MAPPING_KEY'), { code: 'INVALID_MAPPING_KEY' })
    }
    if (value === CUSTOMER_IMPORT_MAPPING_IGNORE || value === null || value === '') {
      continue
    }
    if (!CUSTOMER_IMPORT_FIELD_KEYS.includes(value)) {
      throw Object.assign(new Error('INVALID_DESTINATION_FIELD'), { code: 'INVALID_DESTINATION_FIELD' })
    }
  }
}

/**
 * @param {string[]} headers
 * @param {string} sourceLabel
 */
export function findHeaderColumnIndex(headers, sourceLabel) {
  const target = String(sourceLabel ?? '').trim()
  if (!target) {
    return -1
  }
  const normalizedTarget = target.replace(/\s+/g, '')
  return headers.findIndex((header) => {
    const raw = String(header ?? '').trim()
    if (!raw) {
      return false
    }
    if (raw === target) {
      return true
    }
    return raw.replace(/\s+/g, '') === normalizedTarget
  })
}

/**
 * @param {Record<string, string>} columnMapping
 * @param {string[]} headers
 * @param {string} sourceHeader
 * @param {string} destinationField
 */
export function applySourceColumnMapping(columnMapping, headers, sourceHeader, destinationField) {
  const index = findHeaderColumnIndex(headers, sourceHeader)
  if (index < 0) {
    throw Object.assign(new Error('SOURCE_COLUMN_NOT_FOUND'), { code: 'SOURCE_COLUMN_NOT_FOUND', status: 400 })
  }
  const colKey = `col_${index}`
  const next = { ...columnMapping }
  if (
    destinationField === CUSTOMER_IMPORT_MAPPING_IGNORE ||
    destinationField === null ||
    destinationField === ''
  ) {
    delete next[colKey]
  } else if (!CUSTOMER_IMPORT_FIELD_KEYS.includes(destinationField)) {
    throw Object.assign(new Error('INVALID_DESTINATION_FIELD'), { code: 'INVALID_DESTINATION_FIELD', status: 400 })
  } else {
    next[colKey] = destinationField
  }
  validateUserColumnMapping(next, headers)
  return next
}
