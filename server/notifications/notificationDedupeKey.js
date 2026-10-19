import { notificationReferenceDedupePart, USER_NOTIFICATION_CENTER_SECTIONS, assertNotificationTypeToken } from './userNotificationTypes.js'

/**
 * 알림 중복 식별의 단일 출처.
 *
 * list: 목록 DISTINCT ON. special_date_id 를 포함한다. (기존 목록 식별)
 * cleanup: 기동 시 DELETE. special_date_id 를 포함하지 않는다. (기존 정리 식별)
 *
 * 두 스코프 모두 끝에 reference 구분자를 붙인다.
 * legacy 타입은 이 구분자가 항상 빈 문자열이라 기존 식별이 그대로다.
 * advisor_consultation_lead 만 reference_id(leadId)로 갈라진다.
 */

function column(alias, name) {
  return alias ? `${alias}.${name}` : name
}

export function notificationDedupeReferenceSql(alias = '') {
  const types = USER_NOTIFICATION_CENTER_SECTIONS.filter((section) => section.dedupe === 'reference').map(
    (section) => `'${assertNotificationTypeToken(section.type)}'`,
  )
  if (types.length === 0) {
    return `''`
  }
  return `CASE WHEN ${column(alias, 'type')} IN (${types.join(', ')}) THEN COALESCE(${column(alias, 'reference_id')}, '') ELSE '' END`
}

export function getNotificationDedupeExpressions(scope, alias = '') {
  if (scope !== 'list' && scope !== 'cleanup') {
    throw new Error(`Unknown notification dedupe scope: ${scope}`)
  }
  const expressions = [
    column(alias, 'user_id'),
    column(alias, 'ga_id'),
    column(alias, 'type'),
    `COALESCE(${column(alias, 'customer_id')}, -1)`,
  ]
  if (scope === 'list') {
    expressions.push(`COALESCE(${column(alias, 'special_date_id')}, -1)`)
  }
  expressions.push(
    `COALESCE(${column(alias, 'target_date')}, DATE '1970-01-01')`,
    `COALESCE(${column(alias, 'claim_request_id')}, -1)`,
    notificationDedupeReferenceSql(alias),
  )
  return expressions
}

function coalesceId(value) {
  if (value == null || value === '') {
    return -1
  }
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : -1
}

function coalesceDate(value) {
  if (value == null || value === '') {
    return '1970-01-01'
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return '1970-01-01'
    }
    const year = value.getUTCFullYear()
    const month = String(value.getUTCMonth() + 1).padStart(2, '0')
    const day = String(value.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : '1970-01-01'
}

function readField(row, snake, camel) {
  if (row?.[snake] !== undefined) {
    return row[snake]
  }
  return row?.[camel]
}

/**
 * SQL 키와 같은 순서로 만든 중복 식별 문자열.
 * @param {object} row
 * @param {'list' | 'cleanup'} [scope]
 */
export function getNotificationDedupeKey(row, scope = 'cleanup') {
  if (scope !== 'list' && scope !== 'cleanup') {
    throw new Error(`Unknown notification dedupe scope: ${scope}`)
  }
  const parts = [
    String(readField(row, 'user_id', 'userId') ?? ''),
    String(readField(row, 'ga_id', 'gaId') ?? ''),
    String(row?.type ?? ''),
    String(coalesceId(readField(row, 'customer_id', 'customerId'))),
  ]
  if (scope === 'list') {
    parts.push(String(coalesceId(readField(row, 'special_date_id', 'specialDateId'))))
  }
  parts.push(
    coalesceDate(readField(row, 'target_date', 'targetDate')),
    String(coalesceId(readField(row, 'claim_request_id', 'claimRequestId'))),
    notificationReferenceDedupePart(row),
  )
  return parts.join('\u0001')
}

function compareNotificationId(left, right) {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (Number.isSafeInteger(leftNumber) && Number.isSafeInteger(rightNumber)) {
    return leftNumber - rightNumber
  }
  return String(left).localeCompare(String(right))
}

/**
 * 기동 정리와 같이, 같은 cleanup 키에서 id 가 가장 작은 행만 남긴다.
 * dup.id > keep.id 이므로 더 나중에 생긴 중복만 지운다.
 */
export function retainNotificationsAfterStartupCleanup(rows) {
  const kept = new Map()
  for (const row of rows) {
    const key = getNotificationDedupeKey(row, 'cleanup')
    const current = kept.get(key)
    if (!current || compareNotificationId(row.id, current.id) < 0) {
      kept.set(key, row)
    }
  }
  return [...kept.values()]
}

export function buildNotificationStartupCleanupSql() {
  const left = getNotificationDedupeExpressions('cleanup', 'dup')
  const right = getNotificationDedupeExpressions('cleanup', 'keep')
  const matches = left.map((expression, index) => `${expression} = ${right[index]}`)
  return `
    DELETE FROM notifications dup
    USING notifications keep
    WHERE dup.id > keep.id
      AND ${matches.join('\n      AND ')}
  `
}
