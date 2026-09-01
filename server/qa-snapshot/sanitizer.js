import { createHash } from 'node:crypto'
import { EXCLUDED_COLUMNS, FREE_TEXT_COLUMNS } from './constants.js'

const SAFE_JSON_KEYS = new Set([
  'v',
  'version',
  'fields',
  'type',
  'status',
  'kind',
  'category',
  'purpose',
  'priority',
  'customerId',
  'customer_id',
  'relatedEntityId',
  'related_entity_id',
])

const SAFE_STRING_COLUMNS = new Set([
  'app_version',
  'assignment_date',
  'car_model',
  'car_type',
  'car_year',
  'carrier',
  'consultation_date',
  'content_type',
  'customer_gender_snapshot',
  'date_value',
  'device_platform',
  'due_date',
  'due_time',
  'gender',
  'group_type',
  'height',
  'inflow_source',
  'next_age_date',
  'priority',
  'purpose_type',
  'related_entity_id',
  'related_entity_type',
  'renewal_date',
  'request_type',
  'source_id',
  'source_type',
  'status',
  'target_date',
  'target_gender',
  'type',
  'visibility_scope',
  'weight',
])

function digest(seed, value) {
  return createHash('sha256').update(`${seed}:${String(value ?? '')}`).digest('hex')
}

function stableNumber(seed, value, modulus) {
  return Number.parseInt(digest(seed, value).slice(0, 12), 16) % modulus
}

function sanitizeDate(seed, value) {
  if (!value) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setUTCDate(date.getUTCDate() + stableNumber(seed, value, 181) - 90)
  return date.toISOString().slice(0, 10)
}

function sanitizeJsonValue(value, seed, path = '') {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item, index) => sanitizeJsonValue(item, seed, `${path}.${index}`))
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => SAFE_JSON_KEYS.has(key))
      .map(([key, item]) => [key, sanitizeJsonValue(item, seed, `${path}.${key}`)]),
  )
}

function syntheticName(seed, row) {
  return `QA고객${String(stableNumber(seed, row.id, 900000) + 100000)}`
}

function syntheticPhone(seed, row) {
  void seed
  void row
  return '00000000000'
}

function sanitizeStringColumn(column, value, seed, row) {
  if (value == null) return value
  if (column === 'name' || column.endsWith('_name') || column.endsWith('_name_snapshot')) {
    return syntheticName(seed, row)
  }
  if (column.includes('phone')) return syntheticPhone(seed, row)
  if (column === 'ssn') {
    return '000000-0000000'
  }
  if (column.includes('email')) return `qa+${digest(seed, row.id).slice(0, 12)}@example.invalid`
  if (column === 'customer_code') return `QA-${digest(seed, row.id).slice(0, 16)}`
  if (column === 'car_number') return `QA-${digest(seed, row.id).slice(0, 8).toUpperCase()}`
  if (column === 'link_code') return `qa_${digest(seed, row.id).slice(0, 32)}`
  if (column === 'device_id') return `qa-device-${digest(seed, row.id).slice(0, 20)}`
  if (column === 'reference_id') return `qa-ref-${digest(seed, `${row.id}:${value}`).slice(0, 20)}`
  if (column === 'id' || column.endsWith('_id')) return value
  if (column === 'storage_key') return `qa-fixtures/claims/${digest(seed, row.id).slice(0, 24)}.pdf`
  if (column === 'file_path') return `qa-fixtures/customers/${digest(seed, row.id).slice(0, 24)}.pdf`
  if (column === 'file_name') return `qa-attachment-${row.id}.pdf`
  if (
    /^-?\d+(?:\.\d+)?$/.test(value)
    && /(?:_amount|_count|_day|_index|_order|_size)$/.test(column)
  ) {
    return value
  }
  if (FREE_TEXT_COLUMNS.has(column)) return `[QA 안전 데이터] ${column}`
  if (SAFE_STRING_COLUMNS.has(column)) return value
  return `[QA 안전 데이터] ${column}`
}

export function sanitizeJson(value, seed = 'qa-snapshot') {
  return sanitizeJsonValue(value, seed)
}

export function sanitizeRow(table, row, seed = 'qa-snapshot') {
  const output = {}
  for (const [column, value] of Object.entries(row)) {
    if (EXCLUDED_COLUMNS.has(column)) continue
    if (column.includes('birth_date')) {
      output[column] = sanitizeDate(`${seed}:${row.id}`, value)
    } else if (value && typeof value === 'object' && !(value instanceof Date)) {
      output[column] = sanitizeJson(value, `${seed}:${table}:${row.id}`)
    } else if (typeof value === 'string') {
      output[column] = sanitizeStringColumn(column, value, seed, row)
    } else {
      output[column] = value
    }
  }
  return output
}
