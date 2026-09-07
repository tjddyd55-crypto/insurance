/**
 * billing_payments duplicate preflight (read-only).
 *
 * Production DB 실행은 별도 승인 후에만 수행합니다.
 *
 * Usage:
 *   node server/scripts/billingPaymentDuplicatePreflight.mjs
 */

import pg from 'pg'

const databaseUrl = process.env.DATABASE_URL?.trim()
if (!databaseUrl) {
  console.error('[billing-preflight] DATABASE_URL is required')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 })

async function main() {
  const duplicateOrderIds = await pool.query(`
    SELECT order_id, COUNT(*)::int AS count
    FROM billing_payments
    WHERE order_id IS NOT NULL
    GROUP BY order_id
    HAVING COUNT(*) > 1
    ORDER BY count DESC, order_id
    LIMIT 50
  `)

  const duplicateProviderKeys = await pool.query(`
    SELECT provider, provider_payment_key, COUNT(*)::int AS count
    FROM billing_payments
    WHERE provider_payment_key IS NOT NULL
    GROUP BY provider, provider_payment_key
    HAVING COUNT(*) > 1
    ORDER BY count DESC, provider, provider_payment_key
    LIMIT 50
  `)

  console.log('[billing-preflight] duplicate order_id groups:', duplicateOrderIds.rowCount)
  for (const row of duplicateOrderIds.rows) {
    console.log('  order_id', row.order_id, 'count', row.count)
  }

  console.log('[billing-preflight] duplicate provider_payment_key groups:', duplicateProviderKeys.rowCount)
  for (const row of duplicateProviderKeys.rows) {
    console.log('  provider', row.provider, 'key_suffix', String(row.provider_payment_key).slice(-6), 'count', row.count)
  }

  const exitCode = duplicateOrderIds.rowCount > 0 || duplicateProviderKeys.rowCount > 0 ? 2 : 0
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
