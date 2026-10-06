import {
  AI_SEMANTIC_DATA_CLASS,
  getAiSemanticField,
  getAiSemanticFieldByQueryKey,
} from '../../../shared/ai-assistant/semanticDataCatalog.js'
import {
  getCustomerGenericRelation,
} from '../../../shared/ai-assistant/customer-query/customerGenericRelationCatalog.js'
import { escapeIlikePattern } from '../../lib/customerConsultationListQuery.js'

const SAFE_OPERATOR_SET = new Set([
  'EQ',
  'CONTAINS',
  'STARTS_WITH',
  'ENDS_WITH',
  'IN',
  'GT',
  'GTE',
  'LT',
  'LTE',
  'BEFORE',
  'AFTER',
  'BETWEEN',
  'PERIOD',
  'IS_NULL',
  'IS_NOT_NULL',
  'INCLUDES',
  'EXCLUDES',
])

function fail(code, message, details = {}) {
  const error = new Error(message)
  error.code = code
  error.details = details
  throw error
}

function resolveSemanticField(inputField) {
  const raw = String(inputField ?? '').trim()
  if (!raw) {
    fail('SEMANTIC_FIELD_REQUIRED', '조회 필드가 필요합니다.')
  }
  const semantic = getAiSemanticField(raw) ?? getAiSemanticFieldByQueryKey(raw)
  if (!semantic) {
    fail('SEMANTIC_FIELD_UNKNOWN', `정의되지 않은 조회 필드입니다: ${raw}`, { field: raw })
  }
  if (semantic.dataClass !== AI_SEMANTIC_DATA_CLASS.USER_BUSINESS || !semantic.genericReadAllowed) {
    fail('SEMANTIC_FIELD_NOT_QUERYABLE', `AI 범용 조회 대상이 아닙니다: ${semantic.key}`, {
      semanticKey: semantic.key,
      dataClass: semantic.dataClass,
      semanticDomain: semantic.semanticDomain,
    })
  }
  const relation = getCustomerGenericRelation(semantic.storage.table)
  if (!relation) {
    fail('SEMANTIC_RELATION_NOT_DEFINED', `고객 기준 조회 관계가 정의되지 않았습니다: ${semantic.storage.table}`, {
      semanticKey: semantic.key,
      table: semantic.storage.table,
    })
  }
  return { semantic, relation }
}

function normalizeOperator(raw, semantic) {
  const op = String(raw ?? 'EQ').trim().toUpperCase()
  if (!SAFE_OPERATOR_SET.has(op)) {
    fail('SEMANTIC_OPERATOR_NOT_SUPPORTED', `지원하지 않는 연산자입니다: ${op}`, {
      semanticKey: semantic.key,
      operator: op,
    })
  }
  return op
}

function typeAllowedOperators(semantic) {
  if (semantic.query?.operators?.length) {
    return new Set(semantic.query.operators.map((op) => String(op).toUpperCase()))
  }
  switch (semantic.valueType) {
    case 'boolean':
      return new Set(['EQ', 'IS_NULL', 'IS_NOT_NULL'])
    case 'integer':
    case 'number':
      return new Set(['EQ', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IS_NULL', 'IS_NOT_NULL'])
    case 'date':
    case 'datetime':
      return new Set(['EQ', 'BEFORE', 'AFTER', 'BETWEEN', 'PERIOD', 'IS_NULL', 'IS_NOT_NULL'])
    case 'enum':
      return new Set(['EQ', 'IN', 'IS_NULL', 'IS_NOT_NULL'])
    case 'json':
      return new Set(['EQ', 'CONTAINS', 'IS_NULL', 'IS_NOT_NULL'])
    case 'relation':
    case 'string':
    case 'time':
    default:
      return new Set(['EQ', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'IS_NULL', 'IS_NOT_NULL'])
  }
}

function assertOperatorAllowed(semantic, op) {
  const allowed = typeAllowedOperators(semantic)
  if (!allowed.has(op)) {
    fail('SEMANTIC_OPERATOR_NOT_ALLOWED', `${semantic.label}에 사용할 수 없는 조회 조건입니다: ${op}`, {
      semanticKey: semantic.key,
      operator: op,
      allowedOperators: [...allowed],
    })
  }
}

function makeParam(state, value) {
  const placeholder = `$${state.nextIndex}`
  state.nextIndex += 1
  state.params.push(value)
  return placeholder
}

function columnExpression(semantic, alias) {
  const safeColumn = semantic.storage.column
  const base = `${alias}.${safeColumn}`
  if (semantic.valueType === 'json') {
    return `COALESCE(${base}::text, '')`
  }
  return base
}

function compileSpecialVirtualField(semantic, filter, ctx, state) {
  if (!['customer.company', 'customer.primaryInsurer', 'customer.labels'].includes(semantic.key)) {
    return null
  }
  const relation = getCustomerGenericRelation('customer_custom_fields')
  const alias = relation.alias
  const scope = renderScopePredicates(relation.scopePredicates, ctx)
  const common = [
    relation.customerPredicate,
    ...scope,
  ]

  if (semantic.key === 'customer.company' || semantic.key === 'customer.primaryInsurer') {
    const label = semantic.key === 'customer.company' ? '회사명' : '주력보험사'
    const labelPh = makeParam(state, label)
    common.push(`${alias}.label = ${labelPh}`)
    const op = normalizeOperator(filter.operator, semantic)
    assertOperatorAllowed(semantic, op)
    const valueSql = compileScalarPredicate(`${alias}.value`, semantic, op, filter, state)
    return `EXISTS (SELECT 1 FROM customer_custom_fields ${alias} WHERE ${[...common, valueSql].join(' AND ')})`
  }

  const op = normalizeOperator(filter.operator, semantic)
  if (op !== 'INCLUDES' && op !== 'EXCLUDES') {
    fail('SEMANTIC_OPERATOR_NOT_ALLOWED', '고객 라벨은 INCLUDES/EXCLUDES 조건만 사용할 수 있습니다.', {
      semanticKey: semantic.key,
      operator: op,
    })
  }
  const tagPh = makeParam(state, String(filter.value ?? '').trim())
  common.push(`${alias}.label = ${tagPh}`)
  const exists = `EXISTS (SELECT 1 FROM customer_custom_fields ${alias} WHERE ${common.join(' AND ')})`
  return op === 'EXCLUDES' ? `NOT ${exists}` : exists
}

function renderScopePredicates(predicates, ctx) {
  return (predicates ?? []).map((predicate) =>
    predicate
      .replaceAll('{{user}}', ctx.userPlaceholder)
      .replaceAll('{{ga}}', ctx.gaPlaceholder),
  )
}

function compileScalarPredicate(expr, semantic, op, filter, state) {
  if (op === 'IS_NULL') {
    return semantic.valueType === 'string' || semantic.valueType === 'json'
      ? `COALESCE(TRIM(${expr}::text), '') = ''`
      : `${expr} IS NULL`
  }
  if (op === 'IS_NOT_NULL') {
    return semantic.valueType === 'string' || semantic.valueType === 'json'
      ? `COALESCE(TRIM(${expr}::text), '') <> ''`
      : `${expr} IS NOT NULL`
  }

  if (op === 'IN') {
    const values = Array.isArray(filter.value) ? filter.value : [filter.value]
    const ph = makeParam(state, values)
    return `LOWER(COALESCE(${expr}::text, '')) = ANY(SELECT LOWER(x) FROM unnest(${ph}::text[]) x)`
  }

  if (op === 'BETWEEN' || op === 'PERIOD') {
    const p1 = makeParam(state, filter.value)
    const p2 = makeParam(state, filter.valueTo)
    if (semantic.valueType === 'date' || semantic.valueType === 'datetime') {
      return `${expr}::date >= ${p1}::date AND ${expr}::date <= ${p2}::date`
    }
    return `${expr}::numeric >= ${p1}::numeric AND ${expr}::numeric <= ${p2}::numeric`
  }

  if (['BEFORE', 'AFTER'].includes(op)) {
    const p = makeParam(state, filter.value)
    return op === 'BEFORE'
      ? `${expr}::date < ${p}::date`
      : `${expr}::date > ${p}::date`
  }

  if (['GT', 'GTE', 'LT', 'LTE'].includes(op)) {
    const p = makeParam(state, filter.value)
    const sqlOp = { GT: '>', GTE: '>=', LT: '<', LTE: '<=' }[op]
    return `${expr}::numeric ${sqlOp} ${p}::numeric`
  }

  if (semantic.valueType === 'boolean') {
    const p = makeParam(state, Boolean(filter.value))
    return `${expr} IS NOT DISTINCT FROM ${p}::boolean`
  }

  if (semantic.valueType === 'date' || semantic.valueType === 'datetime') {
    const p = makeParam(state, filter.value)
    return `${expr}::date = ${p}::date`
  }

  if (semantic.valueType === 'integer' || semantic.valueType === 'number') {
    const p = makeParam(state, filter.value)
    return `${expr}::numeric = ${p}::numeric`
  }

  const raw = String(filter.value ?? '')
  if (op === 'ENDS_WITH' && ['customer.phone', 'customer.ssn', 'customer.businessNumber'].includes(semantic.key)) {
    const digits = raw.replace(/\D/g, '')
    const p = makeParam(state, `%${escapeIlikePattern(digits)}`)
    return `regexp_replace(COALESCE(${expr}::text, ''), '[^0-9]', '', 'g') LIKE ${p} ESCAPE '\\'`
  }

  if (op === 'EQ') {
    const p = makeParam(state, raw)
    if (semantic.valueType === 'enum') {
      return `LOWER(TRIM(COALESCE(${expr}::text, ''))) = LOWER(${p}::text)`
    }
    return `${expr}::text = ${p}::text`
  }

  const pattern =
    op === 'STARTS_WITH'
      ? `${escapeIlikePattern(raw)}%`
      : op === 'ENDS_WITH'
        ? `%${escapeIlikePattern(raw)}`
        : `%${escapeIlikePattern(raw)}%`
  const p = makeParam(state, pattern)
  return `COALESCE(${expr}::text, '') ILIKE ${p} ESCAPE '\\'`
}

function compileOneSemanticFilter(filter, ctx, state) {
  const { semantic, relation } = resolveSemanticField(filter.semanticKey ?? filter.field)
  const special = compileSpecialVirtualField(semantic, filter, ctx, state)
  if (special) {
    return { fragment: special, semanticKey: semantic.key }
  }

  const op = normalizeOperator(filter.operator, semantic)
  assertOperatorAllowed(semantic, op)

  if (relation.direct) {
    const expr = columnExpression(semantic, relation.alias)
    return {
      fragment: compileScalarPredicate(expr, semantic, op, filter, state),
      semanticKey: semantic.key,
    }
  }

  const alias = relation.alias
  const expr = columnExpression(semantic, alias)
  const predicate = compileScalarPredicate(expr, semantic, op, filter, state)
  const scope = renderScopePredicates(relation.scopePredicates, ctx)
  return {
    fragment: `EXISTS (
      SELECT 1
      FROM ${semantic.storage.table} ${alias}
      WHERE ${relation.customerPredicate}
        ${scope.length ? `AND ${scope.join(' AND ')}` : ''}
        AND ${predicate}
    )`,
    semanticKey: semantic.key,
  }
}

/**
 * Build safe customer-centric SQL predicates from semantic catalog definitions.
 * User text never becomes an identifier/table/column. Only catalog metadata does.
 */
export function buildGenericCustomerSemanticFilterSql(filters, ctx) {
  const state = {
    nextIndex: Number(ctx.paramStart) || 1,
    params: [],
  }
  const whereFragments = []
  const semanticKeys = []

  for (const filter of filters ?? []) {
    const built = compileOneSemanticFilter(filter, ctx, state)
    whereFragments.push(built.fragment)
    semanticKeys.push(built.semanticKey)
  }

  return {
    whereFragments,
    params: state.params,
    nextIdx: state.nextIndex,
    semanticKeys,
  }
}
