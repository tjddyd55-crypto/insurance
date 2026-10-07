/**
 * billing_payments duplicate preflight (read-only).
 *
 * - SELECT only (no INSERT/UPDATE/DELETE/DDL)
 * - Production DB 실행은 별도 승인 후에만 수행합니다.
 *
 * Usage:
 *   node server/scripts/billingPaymentDuplicatePreflight.mjs
 *
 * Exit codes:
 *   0 — no duplicate groups detected
 *   2 — duplicate groups detected (migration blocked until cleanup)
 *   1 — runtime/query error
 */

import pg from 'pg'

const READONLY_SQL = Object.freeze([
  'SELECT',
  'WITH',
])

function assertReadonlySql(sql) {
  const normalized = String(sql).trim().replace(/^\(/, '').toUpperCase()
  const verb = normalized.split(/\s+/)[0]
  if (!READONLY_SQL.includes(verb)) {
    throw new Error(`readonly_guard_blocked:${verb}`)
  }
}

async function readonlyQuery(pool, sql, params = []) {
  assertReadonlySql(sql)
  return pool.query(sql, params)
}

function redactDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl)
    return {
      protocol: parsed.protocol,
      host: parsed.hostname,
      port: parsed.port || '(default)',
      database: parsed.pathname.replace(/^\//, '') || '(default)',
      user: parsed.username ? '(set)' : '(empty)',
    }
  } catch {
    return { host: '(unparseable)', database: '(unparseable)' }
  }
}

const databaseUrl = process.env.DATABASE_URL?.trim()
if (!databaseUrl) {
  console.error('[billing-preflight] DATABASE_URL is required')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 })

async function main() {
  const target = redactDatabaseUrl(databaseUrl)
  const fingerprint = await readonlyQuery(
    pool,
    `
    SELECT
      current_database() AS database_name,
      current_user AS database_user,
      inet_server_addr()::text AS server_addr,
      version() AS server_version
    `,
  )
  const fp = fingerprint.rows[0] ?? {}

  console.log('[billing-preflight] target fingerprint', {
    ...target,
    database_name: fp.database_name,
    database_user: fp.database_user,
    server_addr: fp.server_addr ?? 'local',
    server_version: String(fp.server_version ?? '').split('\n')[0],
  })

  const totals = await readonlyQuery(
    pool,
    `
    SELECT
      COUNT(*)::int AS total_rows,
      COUNT(*) FILTER (WHERE order_id IS NULL)::int AS order_id_null,
      COUNT(*) FILTER (WHERE order_id = '')::int AS order_id_empty,
      COUNT(*) FILTER (WHERE provider_payment_key IS NULL)::int AS provider_key_null,
      COUNT(*) FILTER (WHERE provider_payment_key = '')::int AS provider_key_empty
    FROM billing_payments
    `,
  )
  console.log('[billing-preflight] row shape', totals.rows[0])

  const duplicateOrderIds = await readonlyQuery(
    pool,
    `
    SELECT order_id, COUNT(*)::int AS count
    FROM billing_payments
    WHERE order_id IS NOT NULL
      AND btrim(order_id) <> ''
    GROUP BY order_id
    HAVING COUNT(*) > 1
    ORDER BY count DESC, order_id
    LIMIT 50
    `,
  )

  const duplicateProviderKeys = await readonlyQuery(
    pool,
    `
    SELECT provider, provider_payment_key, COUNT(*)::int AS count
    FROM billing_payments
    WHERE provider_payment_key IS NOT NULL
      AND btrim(provider_payment_key) <> ''
    GROUP BY provider, provider_payment_key
    HAVING COUNT(*) > 1
    ORDER BY count DESC, provider, provider_payment_key
    LIMIT 50
    `,
  )

  const emptyOrderIds = await readonlyQuery(
    pool,
    `
    SELECT id, user_id, status, created_at
    FROM billing_payments
    WHERE order_id = ''
    ORDER BY created_at DESC
    LIMIT 20
    `,
  )

  const emptyProviderKeys = await readonlyQuery(
    pool,
    `
    SELECT id, user_id, status, created_at
    FROM billing_payments
    WHERE provider_payment_key = ''
    ORDER BY created_at DESC
    LIMIT 20
    `,
  )

  console.log('[billing-preflight] duplicate order_id groups:', duplicateOrderIds.rowCount)
  for (const row of duplicateOrderIds.rows) {
    console.log('  order_id', row.order_id, 'count', row.count)
  }

  console.log('[billing-preflight] duplicate provider_payment_key groups:', duplicateProviderKeys.rowCount)
  for (const row of duplicateProviderKeys.rows) {
    console.log(
      '  provider',
      row.provider,
      'key_suffix',
      String(row.provider_payment_key).slice(-6),
      'count',
      row.count,
    )
  }

  console.log('[billing-preflight] empty-string order_id rows:', emptyOrderIds.rowCount)
  console.log('[billing-preflight] empty-string provider_payment_key rows:', emptyProviderKeys.rowCount)

  const exitCode =
    duplicateOrderIds.rowCount > 0 || duplicateProviderKeys.rowCount > 0 ? 2 : 0
  await pool.end()
  process.exit(exitCode)
}

main().catch(async (error) => {
  console.error('[billing-preflight] failed', error instanceof Error ? error.message : error)
  try {
    await pool.end()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
