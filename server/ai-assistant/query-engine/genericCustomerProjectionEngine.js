import {
  AI_SEMANTIC_DATA_CLASS,
  getAiSemanticField,
} from '../../../shared/ai-assistant/semanticDataCatalog.js'
import { getCustomerGenericRelation } from '../../../shared/ai-assistant/customer-query/customerGenericRelationCatalog.js'

const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/i
const MAX_RETURN_FIELDS = 8

function fail(code, message, details = {}) {
  const error = new Error(message)
  error.code = code
  error.details = details
  throw error
}

function assertSafeIdentifier(value, label) {
  if (!SAFE_IDENTIFIER.test(String(value ?? ''))) {
    fail('UNSAFE_SEMANTIC_STORAGE_IDENTIFIER', `안전하지 않은 ${label} 식별자입니다.`, { value })
  }
}

function renderScopePredicates(predicates, ctx) {
  return (predicates ?? []).map((predicate) =>
    predicate
      .replaceAll('{{user}}', ctx.userPlaceholder)
      .replaceAll('{{ga}}', ctx.gaPlaceholder),
  )
}

function resolveProjectionField(rawKey) {
  const key = String(rawKey ?? '').trim()
  const semantic = getAiSemanticField(key)
  if (!semantic) {
    fail('SEMANTIC_FIELD_UNKNOWN', `정의되지 않은 반환 필드입니다: ${key}`, { semanticKey: key })
  }
  if (
    semantic.dataClass !== AI_SEMANTIC_DATA_CLASS.USER_BUSINESS ||
    semantic.genericReadAllowed !== true ||
    semantic.capabilities?.read === false
  ) {
    fail('SEMANTIC_FIELD_NOT_READABLE', `AI 조회 결과로 반환할 수 없는 필드입니다: ${key}`, {
      semanticKey: key,
      dataClass: semantic.dataClass,
      semanticDomain: semantic.semanticDomain,
    })
  }
  const relation = getCustomerGenericRelation(semantic.storage.table)
  if (!relation) {
    fail('SEMANTIC_RELATION_NOT_DEFINED', `고객 조회 관계가 없습니다: ${semantic.storage.table}`, {
      semanticKey: key,
      table: semantic.storage.table,
    })
  }
  assertSafeIdentifier(semantic.storage.table, 'table')
  assertSafeIdentifier(semantic.storage.column, 'column')
  assertSafeIdentifier(relation.alias, 'alias')
  return { semantic, relation }
}

export function normalizeCustomerReturnFields(rawFields) {
  const values = Array.isArray(rawFields) ? rawFields : []
  const seen = new Set()
  const result = []
  for (const raw of values) {
    const key = String(raw ?? '').trim()
    if (!key || seen.has(key)) continue
    const { semantic } = resolveProjectionField(key)
    seen.add(key)
    result.push(semantic.key)
    if (result.length >= MAX_RETURN_FIELDS) break
  }
  return result
}

function compileSpecialProjection(semantic, relation, ctx) {
  if (!['customer.company', 'customer.primaryInsurer', 'customer.labels'].includes(semantic.key)) {
    return null
  }
  const alias = relation.alias
  const scope = renderScopePredicates(relation.scopePredicates, ctx)
  const common = [relation.customerPredicate, ...scope]

  if (semantic.key === 'customer.company' || semantic.key === 'customer.primaryInsurer') {
    const label = semantic.key === 'customer.company' ? '회사명' : '주력보험사'
    const escaped = label.replaceAll("'", "''")
    common.push(`${alias}.label = '${escaped}'`)
    return `(
      SELECT NULLIF(TRIM(${alias}.value), '')
      FROM customer_custom_fields ${alias}
      WHERE ${common.join(' AND ')}
      ORDER BY ${alias}.id DESC
      LIMIT 1
    )`
  }

  return `(
    SELECT COALESCE(
      jsonb_agg(DISTINCT NULLIF(TRIM(${alias}.label), ''))
        FILTER (WHERE NULLIF(TRIM(${alias}.label), '') IS NOT NULL),
      '[]'::jsonb
    )
    FROM customer_custom_fields ${alias}
    WHERE ${common.join(' AND ')}
  )`
}

function compileProjectionExpression(semantic, relation, ctx) {
  const special = compileSpecialProjection(semantic, relation, ctx)
  if (special) return special

  const alias = relation.alias
  const column = semantic.storage.column
  if (relation.direct) {
    return `${alias}.${column}`
  }

  const scope = renderScopePredicates(relation.scopePredicates, ctx)
  const common = [relation.customerPredicate, ...scope]
  return `(
    SELECT COALESCE(
      jsonb_agg(DISTINCT ${alias}.${column})
        FILTER (WHERE ${alias}.${column} IS NOT NULL),
      '[]'::jsonb
    )
    FROM ${semantic.storage.table} ${alias}
    WHERE ${common.join(' AND ')}
  )`
}

export function buildGenericCustomerProjectionSelect(rawFields, ctx) {
  const returnFields = normalizeCustomerReturnFields(rawFields)
  const selectFragments = []
  const projections = []

  for (let index = 0; index < returnFields.length; index += 1) {
    const key = returnFields[index]
    const { semantic, relation } = resolveProjectionField(key)
    const alias = `ai_projection_${index}`
    const expression = compileProjectionExpression(semantic, relation, ctx)
    selectFragments.push(`${expression} AS ${alias}`)
    projections.push({
      semanticKey: semantic.key,
      label: semantic.label,
      valueType: semantic.valueType,
      resultAlias: alias,
      multiple: !relation.direct && !['customer.company', 'customer.primaryInsurer'].includes(semantic.key),
    })
  }

  return {
    returnFields,
    selectFragments,
    projections,
  }
}

function normalizeProjectionValue(raw, projection) {
  if (projection.multiple) {
    if (Array.isArray(raw)) return raw.filter((value) => value != null && value !== '')
    if (raw == null) return []
    return [raw]
  }
  return raw ?? null
}

export function mapCustomerProjectionRow(row, projectionPlan) {
  return projectionPlan.projections.map((projection) => ({
    semanticKey: projection.semanticKey,
    label: projection.label,
    valueType: projection.valueType,
    value: normalizeProjectionValue(row?.[projection.resultAlias], projection),
  }))
}
