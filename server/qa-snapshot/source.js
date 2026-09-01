import { OPTIONAL_TABLES, SOURCE_SQL, TABLE_ORDER } from './constants.js'

const ALLOWED_SOURCE_SQL = new Set(Object.values(SOURCE_SQL).map(normalizeSql))

function normalizeSql(sql) {
  return String(sql).replace(/\s+/g, ' ').trim()
}

export function assertSourceReadOnlySql(sql) {
  const normalized = normalizeSql(sql)
  if (!normalized.startsWith('SELECT ') || !ALLOWED_SOURCE_SQL.has(normalized)) {
    throw new Error('원본 DB에는 사전 승인된 SELECT만 실행할 수 있습니다.')
  }
  if (/;\s*\S|--|\/\*|\bFOR\s+(UPDATE|SHARE)\b/i.test(normalized)) {
    throw new Error('원본 SELECT에 잠금, 주석 또는 다중 문장을 사용할 수 없습니다.')
  }
}

async function sourceSelect(client, sql, params = []) {
  assertSourceReadOnlySql(sql)
  return client.query(sql, params)
}

export async function withReadOnlySnapshot(pool, operation) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    await client.query(`SET LOCAL statement_timeout = '120s'`)
    await client.query(`SET LOCAL lock_timeout = '5s'`)
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function inspectSourceTables(client) {
  const result = await sourceSelect(client, SOURCE_SQL.tableColumns, [TABLE_ORDER])
  const tables = new Map()
  for (const row of result.rows) {
    if (!tables.has(row.table_name)) tables.set(row.table_name, new Set())
    tables.get(row.table_name).add(row.column_name)
  }
  return tables
}

async function resolveSourceScope(client, sourceGaCode) {
  const gaResult = await sourceSelect(client, SOURCE_SQL.ga, [sourceGaCode])
  if (gaResult.rowCount !== 1) {
    throw new Error('원본 GA 코드는 정확히 하나의 GA와 일치해야 합니다.')
  }
  return { gaId: gaResult.rows[0].id }
}

function parametersFor(table, context) {
  if (table === 'customers') return [context.gaId, context.limit]
  if (table === 'memo') return [context.gaId, context.sourceUserIds]
  if (table === 'ta_call_settings') return [context.sourceUserIds]
  if (table === 'todos') return [context.customerIds.map(String)]
  return [context.customerIds]
}

function activeRows(table, rows) {
  if (!['customers', 'customer_relation_groups', 'customer_relation_group_members'].includes(table)) {
    return rows
  }
  return rows.filter((row) => !row.deleted_at)
}

async function extractTable(client, table, context, sourceTables, manifest) {
  if (!sourceTables.has(table)) {
    manifest[table] = { extracted: 0, loaded: 0, skipped: 'source table missing' }
    return []
  }
  try {
    const result = await sourceSelect(client, SOURCE_SQL[table], parametersFor(table, context))
    const rows = activeRows(table, result.rows)
    manifest[table] = { extracted: rows.length, loaded: 0 }
    return rows
  } catch (error) {
    if (!OPTIONAL_TABLES.has(table)) throw error
    manifest[table] = { extracted: 0, loaded: 0, skipped: `source schema mismatch: ${error.code ?? 'query'}` }
    return []
  }
}

export async function extractQaSnapshot(client, options) {
  const sourceTables = await inspectSourceTables(client)
  const scope = await resolveSourceScope(client, options.sourceGaCode)
  const manifest = {}
  const data = {}
  data.customers = await extractTable(
    client,
    'customers',
    { ...scope, limit: options.limit, customerIds: [] },
    sourceTables,
    manifest,
  )
  if (data.customers.length < options.limit) {
    throw new Error(`원본 GA에서 활성 고객 ${options.limit}명을 찾지 못했습니다.`)
  }
  const selectedUserIds = [...new Set(data.customers.map((row) => String(row.user_id)))].slice(0, 1)
  const context = {
    ...scope,
    sourceUserIds: selectedUserIds,
    customerIds: data.customers.map((row) => Number(row.id)),
  }
  for (const table of TABLE_ORDER.slice(1)) {
    data[table] = await extractTable(client, table, context, sourceTables, manifest)
  }
  return { data, manifest, scope }
}
