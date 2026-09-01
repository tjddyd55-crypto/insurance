import { randomUUID } from 'node:crypto'
import {
  RESET_ORDER,
  TABLE_ORDER,
  USER_ID_COLUMNS,
} from './constants.js'
import {
  createIdMaps,
  mappedId,
  recordIdMapping,
  remapRelationRow,
  remapTodoCustomerReferences,
} from './idMaps.js'
import { sanitizeRow } from './sanitizer.js'

const DESTINATION_SCHEMA_SQL = `
  SELECT table_name, column_name, is_nullable, column_default, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = ANY($1::text[])
  ORDER BY table_name, ordinal_position
`

function quoteIdentifier(value) {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error(`허용되지 않은 식별자: ${value}`)
  return `"${value}"`
}

async function inspectDestinationSchema(client) {
  const names = [...TABLE_ORDER, 'users']
  const result = await client.query(DESTINATION_SCHEMA_SQL, [names])
  const schema = new Map()
  for (const column of result.rows) {
    if (!schema.has(column.table_name)) schema.set(column.table_name, new Map())
    schema.get(column.table_name).set(column.column_name, column)
  }
  return schema
}

async function resolveTargetUser(client, targetUserId) {
  const result = await client.query(
    `SELECT u.*,
      (SELECT tenant_id
       FROM user_memberships
       WHERE user_id = u.id AND status = 'active' AND tenant_id IS NOT NULL
       ORDER BY id
       LIMIT 1) AS qa_tenant_id
     FROM users u
     WHERE u.id = $1
     LIMIT 1`,
    [targetUserId],
  )
  if (result.rowCount !== 1) throw new Error('대상 DEV 사용자가 존재하지 않습니다.')
  const user = result.rows[0]
  if (user.ga_id == null) throw new Error('대상 DEV 사용자에 GA가 지정되지 않았습니다.')
  return { id: String(user.id), gaId: user.ga_id, tenantId: user.qa_tenant_id ?? null }
}

function remapForeignKeys(table, row, idMaps) {
  if (table === 'customer_relations') return remapRelationRow(row, idMaps)
  if (table === 'todos') return remapTodoCustomerReferences(row, idMaps)
  const result = { ...row }
  if ('customer_id' in result) result.customer_id = mappedId(idMaps, 'customers', result.customer_id)
  if ('related_customer_id' in result) {
    result.related_customer_id = mappedId(idMaps, 'customers', result.related_customer_id)
  }
  if ('group_id' in result) {
    result.group_id = mappedId(idMaps, 'customer_relation_groups', result.group_id)
  }
  if ('link_id' in result) {
    result.link_id = mappedId(idMaps, 'customer_app_links', result.link_id, { optional: true })
  }
  if ('request_id' in result) {
    result.request_id = mappedId(idMaps, 'customer_claim_requests', result.request_id)
  }
  if ('claim_request_id' in result) {
    result.claim_request_id = mappedId(
      idMaps,
      'customer_claim_requests',
      result.claim_request_id,
      { optional: true },
    )
  }
  if ('special_date_id' in result) {
    result.special_date_id = mappedId(
      idMaps,
      'customer_special_dates',
      result.special_date_id,
      { optional: true },
    )
  }
  return result
}

function applyTargetScope(row, target) {
  const result = { ...row }
  for (const column of USER_ID_COLUMNS) {
    if (column in result) result[column] = target.id
  }
  if ('ga_id' in result) result.ga_id = target.gaId
  if ('tenant_id' in result) result.tenant_id = target.tenantId
  return result
}

function applySafeRequiredValues(table, row, sourceRow) {
  if (table === 'customer_app_profiles') {
    return {
      ...row,
      device_id: row.device_id || `qa-device-${sourceRow.id}`,
      name: row.name || `QA고객${sourceRow.id}`,
      birth_date: row.birth_date || '1990-01-01',
      phone: row.phone || '00000000000',
    }
  }
  if (table === 'customer_claim_requests') {
    return {
      ...row,
      device_id: row.device_id || `qa-device-${sourceRow.id}`,
      requester_name: row.requester_name || `QA고객${sourceRow.id}`,
      requester_birth_date: row.requester_birth_date || '1990-01-01',
      requester_phone: row.requester_phone || '00000000000',
    }
  }
  return row
}

function applyFixtureFile(table, row, sourceRow, fixtures) {
  if (!fixtures || !['files', 'customer_claim_request_files'].includes(table)) return row
  const sourceMime = String(sourceRow.mime_type ?? sourceRow.content_type ?? '').toLowerCase()
  const fixture = sourceMime.startsWith('image/') ? fixtures.png : fixtures.pdf
  if (table === 'files') {
    return {
      ...row,
      file_path: fixture.key,
      folder_id: null,
      team_id: null,
      original_name: sourceMime.startsWith('image/') ? 'QA-대표이미지.png' : 'QA-대표문서.pdf',
      display_name: sourceMime.startsWith('image/') ? 'QA 대표 이미지' : 'QA 대표 문서',
      file_size: fixture.size,
      mime_type: fixture.mimeType,
      status: 'active',
      is_confirmed: true,
      deleted_at: null,
    }
  }
  return {
    ...row,
    storage_key: fixture.key,
    file_name: sourceMime.startsWith('image/') ? 'QA-대표이미지.png' : 'QA-대표문서.pdf',
    file_size: fixture.size,
    content_type: fixture.mimeType,
  }
}

function prepareRow(table, sourceRow, target, idMaps, seed, fixtures) {
  let row = sanitizeRow(table, sourceRow, seed)
  row = remapForeignKeys(table, row, idMaps)
  row = applyTargetScope(row, target)
  row = applySafeRequiredValues(table, row, sourceRow)
  row = applyFixtureFile(table, row, sourceRow, fixtures)
  if (table === 'customer_card_payment_contracts') {
    row.payment_card_id = null
    row.policy_number = `QA-${String(sourceRow.id).padStart(6, '0')}`
  }
  delete row.id
  return row
}

function insertableRow(table, row, columns) {
  const output = {}
  for (const [key, value] of Object.entries(row)) {
    if (columns.has(key)) output[key] = value
  }
  const missing = [...columns.values()].filter((column) => {
    const generated = column.column_default != null || column.column_name === 'id'
    return !generated && column.is_nullable === 'NO' && output[column.column_name] == null
  })
  if (missing.length) {
    throw new Error(
      `${table} 필수 컬럼 누락: ${missing.map((column) => column.column_name).join(', ')}`,
    )
  }
  return output
}

async function insertRow(client, table, row, columns) {
  const insertable = insertableRow(table, row, columns)
  const names = Object.keys(insertable)
  if (!names.length) throw new Error(`${table}에 삽입할 컬럼이 없습니다.`)
  const sql = `INSERT INTO ${quoteIdentifier(table)} (${names.map(quoteIdentifier).join(', ')})
    VALUES (${names.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING id`
  const result = await client.query(sql, Object.values(insertable))
  return result.rows[0]?.id
}

async function ensureLedger(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS qa_snapshot_runs (
      id UUID PRIMARY KEY,
      source_ga_code TEXT NOT NULL,
      target_user_id TEXT NOT NULL REFERENCES users(id),
      customer_limit INTEGER NOT NULL,
      manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `)
  await client.query(`
    CREATE TABLE IF NOT EXISTS qa_snapshot_rows (
      run_id UUID NOT NULL REFERENCES qa_snapshot_runs(id) ON DELETE CASCADE,
      table_name TEXT NOT NULL,
      source_id TEXT NOT NULL,
      destination_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (run_id, table_name, destination_id)
    )
  `)
}

async function recordLedgerRows(client, runId, table, rows) {
  if (!rows.length) return
  const params = []
  const values = rows.map((row, index) => {
    const offset = index * 4
    params.push(runId, table, String(row.sourceId), String(row.destinationId))
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`
  })
  await client.query(
    `INSERT INTO qa_snapshot_rows (run_id, table_name, source_id, destination_id)
     VALUES ${values.join(', ')}`,
    params,
  )
}

async function loadTable(client, table, rows, context) {
  const columns = context.schema.get(table)
  if (!columns) {
    context.manifest[table] = { ...context.manifest[table], loaded: 0, skipped: 'destination table missing' }
    return
  }
  if (table === 'ta_call_settings') {
    const existing = await client.query(
      'SELECT id FROM ta_call_settings WHERE user_id = $1 LIMIT 1',
      [context.target.id],
    )
    if (existing.rowCount > 0) {
      context.manifest[table] = {
        ...context.manifest[table],
        loaded: 0,
        skippedRows: rows.length,
        skipped: 'target user settings preserved',
      }
      return
    }
  }
  let loaded = 0
  const ledgerRows = []
  for (const sourceRow of rows) {
    const row = prepareRow(
      table,
      sourceRow,
      context.target,
      context.idMaps,
      context.seed,
      context.fixtures,
    )
    const newId = await insertRow(client, table, row, columns)
    ledgerRows.push({ sourceId: sourceRow.id, destinationId: newId })
    recordIdMapping(context.idMaps, table, sourceRow.id, newId)
    loaded += 1
  }
  await recordLedgerRows(client, context.runId, table, ledgerRows)
  context.manifest[table] = {
    ...context.manifest[table],
    loaded,
    skippedRows: 0,
  }
}

export async function validateDestination(pool, targetUserId) {
  const client = await pool.connect()
  try {
    const schema = await inspectDestinationSchema(client)
    const target = await resolveTargetUser(client, targetUserId)
    return { schema, target }
  } finally {
    client.release()
  }
}

export async function loadQaSnapshot(pool, snapshot, options) {
  const client = await pool.connect()
  const runId = randomUUID()
  try {
    await client.query('BEGIN')
    await ensureLedger(client)
    const schema = await inspectDestinationSchema(client)
    const target = await resolveTargetUser(client, options.targetUserId)
    await client.query(
      `INSERT INTO qa_snapshot_runs (id, source_ga_code, target_user_id, customer_limit)
       VALUES ($1, $2, $3, $4)`,
      [runId, options.sourceGaCode, target.id, options.limit],
    )
    const context = {
      runId,
      seed: `qa-snapshot:v1:${options.sourceGaCode.toUpperCase()}`,
      target,
      schema,
      idMaps: createIdMaps(),
      manifest: structuredClone(snapshot.manifest),
      fixtures: options.fixtures,
    }
    for (const table of TABLE_ORDER) {
      await loadTable(client, table, snapshot.data[table] ?? [], context)
    }
    await client.query(
      `UPDATE qa_snapshot_runs SET manifest = $2::jsonb, completed_at = NOW() WHERE id = $1`,
      [runId, JSON.stringify(context.manifest)],
    )
    await client.query('COMMIT')
    return { runId, manifest: context.manifest, idMaps: context.idMaps }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

export function getResetDeleteOrder() {
  return [...RESET_ORDER]
}

export async function resetQaSnapshotRun(pool, runId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const rows = await client.query(
      `SELECT table_name, destination_id FROM qa_snapshot_rows WHERE run_id = $1`,
      [runId],
    )
    for (const table of RESET_ORDER) {
      const ids = rows.rows.filter((row) => row.table_name === table).map((row) => row.destination_id)
      if (ids.length) {
        await client.query(`DELETE FROM ${quoteIdentifier(table)} WHERE id::text = ANY($1::text[])`, [ids])
      }
    }
    await client.query('DELETE FROM qa_snapshot_rows WHERE run_id = $1', [runId])
    await client.query('DELETE FROM qa_snapshot_runs WHERE id = $1', [runId])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
