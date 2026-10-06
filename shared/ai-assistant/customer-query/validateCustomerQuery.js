import {
  CUSTOMER_QUERY_LOGIC,
  CUSTOMER_QUERY_OPERATORS,
  CUSTOMER_QUERY_PERIOD_TOKENS,
  getCustomerQueryField,
} from './customerQuerySchema.js'
import { getAiSemanticField, getAiSemanticFieldByQueryKey } from '../semanticDataCatalog.js'
import { resolveCustomerQueryPeriod } from './resolvePeriodToken.js'

function inferOperators(semantic) {
  if (semantic.query?.operators?.length) return [...semantic.query.operators]
  switch (semantic.valueType) {
    case 'boolean': return ['EQ', 'IS_NULL', 'IS_NOT_NULL']
    case 'integer':
    case 'number': return ['EQ', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IS_NULL', 'IS_NOT_NULL']
    case 'date':
    case 'datetime': return ['EQ', 'BEFORE', 'AFTER', 'BETWEEN', 'PERIOD', 'IS_NULL', 'IS_NOT_NULL']
    case 'enum': return ['EQ', 'IN', 'IS_NULL', 'IS_NOT_NULL']
    case 'json': return ['EQ', 'CONTAINS', 'IS_NULL', 'IS_NOT_NULL']
    default: return ['EQ', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'IS_NULL', 'IS_NOT_NULL']
  }
}

function resolveFieldDefinition(rawField) {
  const key = String(rawField ?? '').trim()
  const legacy = getCustomerQueryField(key)
  if (legacy) {
    const relationPreferred = {
      carType: 'vehicle.carType',
      carNumber: 'vehicle.carNumber',
      carModel: 'vehicle.carModel',
      carYear: 'vehicle.carYear',
      renewalDate: 'vehicle.renewalDate',
    }[legacy.key]
    const semantic =
      (relationPreferred ? getAiSemanticField(relationPreferred) : null) ??
      getAiSemanticField(legacy.semanticKey) ??
      getAiSemanticFieldByQueryKey(legacy.key)
    return {
      key,
      semanticKey: semantic?.key ?? legacy.semanticKey ?? key,
      label: legacy.label,
      type: legacy.type,
      operators: [...legacy.operators],
      searchable: legacy.searchable && semantic?.genericReadAllowed !== false,
      canonicalValues: semantic?.canonicalValues ?? legacy.canonicalValues ?? null,
    }
  }
  const semantic = getAiSemanticField(key) ?? getAiSemanticFieldByQueryKey(key)
  if (!semantic) return null
  return {
    key,
    semanticKey: semantic.key,
    label: semantic.label,
    type: semantic.valueType,
    operators: inferOperators(semantic),
    searchable: semantic.genericReadAllowed === true,
    canonicalValues: semantic.canonicalValues,
  }
}

export function validateCustomerQueryAst(raw) {
  if (raw == null) return { ok: true, ast: { logic: 'AND', filters: [], sort: [], limit: 20 } }
  const obj = typeof raw === 'object' ? raw : null
  if (!obj) return { ok: false, code: 'INVALID_VALUE', message: 'customerQuery 형식이 올바르지 않습니다.' }

  const unsupportedField = obj.unsupportedField ?? obj.unsupported_field ?? null
  if (unsupportedField) {
    const name = String(unsupportedField).trim()
    return { ok: false, code: 'UNSUPPORTED_FIELD', field: name, message: '현재 고객정보에는 ' + name + '으로 조회할 수 있는 항목이 없습니다.' }
  }

  const logic = String(obj.logic ?? 'AND').toUpperCase()
  if (!CUSTOMER_QUERY_LOGIC.includes(logic)) {
    return { ok: false, code: 'INVALID_VALUE', message: '지원하지 않는 조건 결합 방식입니다.' }
  }

  const filters = []
  for (const item of Array.isArray(obj.filters) ? obj.filters : []) {
    const fieldKey = String(item?.semanticKey ?? item?.field ?? '').trim()
    const def = resolveFieldDefinition(fieldKey)
    if (!def) return { ok: false, code: 'UNKNOWN_FIELD', field: fieldKey, message: '현재 고객정보에는 해당 조건으로 조회할 수 있는 항목이 없습니다.' }
    if (!def.searchable) return { ok: false, code: 'UNSUPPORTED_FIELD', field: fieldKey, message: def.label + ' 항목은 AI 범용 조회 대상이 아닙니다.' }

    const operator = String(item?.operator ?? '').trim().toUpperCase()
    if (!CUSTOMER_QUERY_OPERATORS.includes(operator) || !def.operators.includes(operator)) {
      return { ok: false, code: 'INVALID_OPERATOR', field: fieldKey, message: def.label + ' 조건의 연산자가 올바르지 않습니다.' }
    }

    const normalized = normalizeFilterValue(def, operator, item)
    if (!normalized.ok) return normalized
    filters.push({
      field: def.semanticKey,
      semanticKey: def.semanticKey,
      originalField: fieldKey,
      operator,
      value: normalized.value,
      valueTo: normalized.valueTo ?? null,
    })
  }

  const limitRaw = obj.limit
  const limit = limitRaw == null ? 20 : Math.min(Math.max(Number(limitRaw) || 20, 1), 50)
  const sort = Array.isArray(obj.sort)
    ? obj.sort.map((s) => {
        const def = resolveFieldDefinition(s?.field)
        return def?.searchable
          ? { field: def.semanticKey, semanticKey: def.semanticKey, direction: String(s?.direction ?? 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC' }
          : null
      }).filter(Boolean)
    : []

  return { ok: true, ast: { logic: 'AND', filters, sort, limit } }
}

function normalizeFilterValue(def, operator, item) {
  if (operator === 'IS_NULL' || operator === 'IS_NOT_NULL') return { ok: true, value: null, valueTo: null }
  const valueRaw = item?.value
  const valueToRaw = item?.valueTo ?? item?.value_to ?? null

  if (def.semanticKey === 'customer.gender') {
    if (operator === 'IN') {
      const list = Array.isArray(valueRaw) ? valueRaw : String(valueRaw ?? '').split(',').map((x) => x.trim())
      const normalized = list.map(normalizeGenderToken).filter(Boolean)
      if (!normalized.length) return { ok: false, code: 'INVALID_VALUE', message: '성별 값이 올바르지 않습니다.' }
      return { ok: true, value: normalized, valueTo: null }
    }
    const g = normalizeGenderToken(valueRaw)
    return g ? { ok: true, value: g, valueTo: null } : { ok: false, code: 'INVALID_VALUE', message: '성별 값이 올바르지 않습니다.' }
  }

  if (def.type === 'boolean') {
    const v = valueRaw === true || String(valueRaw ?? '').toLowerCase() === 'true'
      ? true
      : valueRaw === false || String(valueRaw ?? '').toLowerCase() === 'false'
        ? false
        : null
    return v == null
      ? { ok: false, code: 'INVALID_VALUE', message: def.label + ' 값이 올바르지 않습니다.' }
      : { ok: true, value: v, valueTo: null }
  }

  if (def.type === 'date' || def.type === 'datetime') {
    if (operator === 'PERIOD') {
      const token = String(valueRaw ?? '').trim().toUpperCase()
      if (!CUSTOMER_QUERY_PERIOD_TOKENS.includes(token)) return { ok: false, code: 'INVALID_VALUE', message: '날짜 기간 토큰이 올바르지 않습니다.' }
      const range = resolveCustomerQueryPeriod(token)
      return range
        ? { ok: true, value: range.from, valueTo: range.to }
        : { ok: false, code: 'INVALID_VALUE', message: '날짜 기간을 계산할 수 없습니다.' }
    }
    const from = normalizeDateYmd(valueRaw)
    if (!from) return { ok: false, code: 'INVALID_VALUE', message: def.label + ' 날짜 형식이 올바르지 않습니다.' }
    if (operator === 'BETWEEN') {
      const to = normalizeDateYmd(valueToRaw)
      if (!to || from > to) return { ok: false, code: 'INVALID_VALUE', message: def.label + ' 날짜 범위가 올바르지 않습니다.' }
      return { ok: true, value: from, valueTo: to }
    }
    return { ok: true, value: from, valueTo: null }
  }

  if (def.type === 'integer' || def.type === 'number' || def.type === 'derived') {
    if (operator === 'BETWEEN') {
      const min = Number(valueRaw)
      const max = Number(valueToRaw)
      return Number.isFinite(min) && Number.isFinite(max)
        ? { ok: true, value: min, valueTo: max }
        : { ok: false, code: 'INVALID_VALUE', message: def.label + ' 숫자 범위가 올바르지 않습니다.' }
    }
    const n = Number(valueRaw)
    return Number.isFinite(n)
      ? { ok: true, value: n, valueTo: null }
      : { ok: false, code: 'INVALID_VALUE', message: def.label + ' 값이 올바르지 않습니다.' }
  }

  if (def.type === 'enum' && operator === 'IN') {
    const list = Array.isArray(valueRaw) ? valueRaw : [valueRaw]
    const normalized = list.map((v) => String(v ?? '').trim()).filter(Boolean)
    return normalized.length
      ? { ok: true, value: normalized, valueTo: null }
      : { ok: false, code: 'INVALID_VALUE', message: def.label + ' 값이 필요합니다.' }
  }

  const text = String(valueRaw ?? '').trim()
  if (!text) return { ok: false, code: 'INVALID_VALUE', message: def.label + ' 조건 값이 필요합니다.' }
  if (text.length > 200) return { ok: false, code: 'INVALID_VALUE', message: def.label + ' 조건 값이 너무 깁니다.' }
  return { ok: true, value: text, valueTo: valueToRaw ? String(valueToRaw).trim() : null }
}

function normalizeGenderToken(raw) {
  const v = String(raw ?? '').trim().toUpperCase()
  if (v === 'MALE' || v === 'M') return 'male'
  if (v === 'FEMALE' || v === 'F') return 'female'
  return null
}

function normalizeDateYmd(raw) {
  const s = String(raw ?? '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}
