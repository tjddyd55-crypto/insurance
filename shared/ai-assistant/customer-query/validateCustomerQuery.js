import {
  CUSTOMER_QUERY_LOGIC,
  CUSTOMER_QUERY_OPERATORS,
  CUSTOMER_QUERY_PERIOD_TOKENS,
  getCustomerQueryField,
} from './customerQuerySchema.js'
import { resolveCustomerQueryPeriod } from './resolvePeriodToken.js'

/**
 * @param {unknown} raw
 * @returns {{
 *   ok: true,
 *   ast: { logic: 'AND', filters: object[], sort: object[], limit: number },
 * } | {
 *   ok: false,
 *   code: 'UNKNOWN_FIELD' | 'INVALID_OPERATOR' | 'INVALID_VALUE' | 'UNSUPPORTED_FIELD',
 *   field?: string,
 *   message: string,
 * }}
 */
export function validateCustomerQueryAst(raw) {
  if (raw == null) {
    return {
      ok: true,
      ast: { logic: 'AND', filters: [], sort: [], limit: 20 },
    }
  }
  const obj = typeof raw === 'object' ? raw : null
  if (!obj) {
    return { ok: false, code: 'INVALID_VALUE', message: 'customerQuery 형식이 올바르지 않습니다.' }
  }

  const unsupportedField = obj.unsupportedField ?? obj.unsupported_field ?? null
  if (unsupportedField) {
    const name = String(unsupportedField).trim()
    return {
      ok: false,
      code: 'UNSUPPORTED_FIELD',
      field: name,
      message: `현재 고객정보에는 ${name}으로 조회할 수 있는 항목이 없습니다.`,
    }
  }

  const logic = String(obj.logic ?? 'AND').toUpperCase()
  if (!CUSTOMER_QUERY_LOGIC.includes(logic)) {
    return { ok: false, code: 'INVALID_VALUE', message: '지원하지 않는 조건 결합 방식입니다.' }
  }

  const filtersRaw = Array.isArray(obj.filters) ? obj.filters : []
  const filters = []
  for (const item of filtersRaw) {
    const fieldKey = String(item?.field ?? '').trim()
    const def = getCustomerQueryField(fieldKey)
    if (!def) {
      return {
        ok: false,
        code: 'UNKNOWN_FIELD',
        field: fieldKey,
        message: '현재 고객정보에는 해당 조건으로 조회할 수 있는 항목이 없습니다.',
      }
    }
    const operator = String(item?.operator ?? '').trim().toUpperCase()
    if (!CUSTOMER_QUERY_OPERATORS.includes(operator) || !def.operators.includes(operator)) {
      return {
        ok: false,
        code: 'INVALID_OPERATOR',
        field: fieldKey,
        message: `${def.label} 조건의 연산자가 올바르지 않습니다.`,
      }
    }
    const normalized = normalizeFilterValue(def, operator, item)
    if (!normalized.ok) {
      return normalized
    }
    filters.push({
      field: fieldKey,
      operator,
      value: normalized.value,
      valueTo: normalized.valueTo ?? null,
    })
  }

  const limitRaw = obj.limit
  const limit =
    limitRaw == null ? 20 : Math.min(Math.max(Number(limitRaw) || 20, 1), 50)

  const sort = Array.isArray(obj.sort)
    ? obj.sort
        .map((s) => ({
          field: String(s?.field ?? '').trim(),
          direction: String(s?.direction ?? 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
        }))
        .filter((s) => getCustomerQueryField(s.field))
    : []

  return { ok: true, ast: { logic: 'AND', filters, sort, limit } }
}

/**
 * @param {import('./customerQuerySchema.js').CUSTOMER_QUERY_FIELD_DEFINITIONS[number]} def
 */
function normalizeFilterValue(def, operator, item) {
  if (operator === 'IS_NULL' || operator === 'IS_NOT_NULL') {
    return { ok: true, value: null, valueTo: null }
  }

  const valueRaw = item?.value
  const valueToRaw = item?.valueTo ?? item?.value_to ?? null

  if (def.type === 'enum' && def.key === 'gender') {
    const v = String(valueRaw ?? '').trim().toUpperCase()
    if (operator === 'IN') {
      const list = Array.isArray(valueRaw)
        ? valueRaw
        : String(valueRaw ?? '')
            .split(',')
            .map((x) => x.trim())
      const normalized = list.map((x) => normalizeGenderToken(x)).filter(Boolean)
      if (!normalized.length) {
        return { ok: false, code: 'INVALID_VALUE', message: '성별 값이 올바르지 않습니다.' }
      }
      return { ok: true, value: normalized, valueTo: null }
    }
    const g = normalizeGenderToken(v)
    if (!g) {
      return { ok: false, code: 'INVALID_VALUE', message: '성별 값이 올바르지 않습니다.' }
    }
    return { ok: true, value: g, valueTo: null }
  }

  if (def.type === 'date') {
    if (operator === 'PERIOD') {
      const token = String(valueRaw ?? '').trim().toUpperCase()
      if (!CUSTOMER_QUERY_PERIOD_TOKENS.includes(token)) {
        return { ok: false, code: 'INVALID_VALUE', message: '날짜 기간 토큰이 올바르지 않습니다.' }
      }
      const range = resolveCustomerQueryPeriod(token)
      if (!range) {
        return { ok: false, code: 'INVALID_VALUE', message: '날짜 기간을 계산할 수 없습니다.' }
      }
      return { ok: true, value: range.from, valueTo: range.to, periodToken: token }
    }
    const from = normalizeDateYmd(valueRaw)
    if (!from) {
      return { ok: false, code: 'INVALID_VALUE', message: `${def.label} 날짜 형식이 올바르지 않습니다.` }
    }
    if (operator === 'BETWEEN') {
      const to = normalizeDateYmd(valueToRaw)
      if (!to || from > to) {
        return { ok: false, code: 'INVALID_VALUE', message: `${def.label} 날짜 범위가 올바르지 않습니다.` }
      }
      return { ok: true, value: from, valueTo: to }
    }
    return { ok: true, value: from, valueTo: null }
  }

  if (def.type === 'derived' && def.key === 'insuranceAge') {
    if (operator === 'BETWEEN') {
      const min = Number(valueRaw)
      const max = Number(valueToRaw)
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return { ok: false, code: 'INVALID_VALUE', message: '보험나이 범위가 올바르지 않습니다.' }
      }
      return { ok: true, value: min, valueTo: max }
    }
    const n = Number(valueRaw)
    if (!Number.isFinite(n)) {
      return { ok: false, code: 'INVALID_VALUE', message: '보험나이 값이 올바르지 않습니다.' }
    }
    return { ok: true, value: n, valueTo: null }
  }

  const text = String(valueRaw ?? '').trim()
  if (!text && operator !== 'IS_NULL' && operator !== 'IS_NOT_NULL') {
    return { ok: false, code: 'INVALID_VALUE', message: `${def.label} 조건 값이 필요합니다.` }
  }
  if (text.length > 200) {
    return { ok: false, code: 'INVALID_VALUE', message: `${def.label} 조건 값이 너무 깁니다.` }
  }
  return { ok: true, value: text, valueTo: valueToRaw ? String(valueToRaw).trim() : null }
}

function normalizeGenderToken(raw) {
  const v = String(raw ?? '').trim().toUpperCase()
  if (v === 'MALE' || v === 'M') {
    return 'male'
  }
  if (v === 'FEMALE' || v === 'F') {
    return 'female'
  }
  if (v === 'male' || v === 'female') {
    return v
  }
  return null
}

function normalizeDateYmd(raw) {
  const s = String(raw ?? '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}
