/**
 * Development-only: delete customers for one GA (default YJASSET). Counts only in logs.
 */
import pool from '../db.js'
import { isDevelopmentDbTarget, isProductionDbTarget } from '../lib/dbEnvironmentGuard.js'

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString || isProductionDbTarget(connectionString)) {
    console.error('[dev-customer-clear] abort')
    process.exit(1)
  }
  if (String(process.env.INSURANCE_DB_ENVIRONMENT ?? '').toLowerCase() !== 'development') {
    console.error('[dev-customer-clear] INSURANCE_DB_ENVIRONMENT=development required')
    process.exit(1)
  }
  const gaCode = String(process.env.INSURANCE_DEV_CLEAR_GA_CODE ?? 'YJASSET').trim()
  const gaRes = await pool.query(`SELECT id FROM ga_companies WHERE code = $1 LIMIT 1`, [gaCode])
  const gaId = gaRes.rows[0]?.id
  if (!gaId) {
    console.error('[dev-customer-clear] GA not found', gaCode)
    process.exit(1)
  }
  const client = await pool.connect()
  let deleted = 0
  try {
    await client.query('BEGIN')
    const beforeRes = await client.query(`SELECT COUNT(*)::int AS c FROM customers WHERE ga_id = $1`, [gaId])
    // folders.customer_id is ON DELETE SET NULL — bulk customer delete can violate uq_folders_user_ga_personal_parent_name
    await client.query(`DELETE FROM folders WHERE ga_id = $1 AND customer_id IS NOT NULL`, [gaId])
    await client.query(`DELETE FROM insurance_forms WHERE ga_id = $1`, [gaId])
    const del = await client.query(`DELETE FROM customers WHERE ga_id = $1`, [gaId])
    deleted = del.rowCount ?? 0
    const afterRes = await client.query(`SELECT COUNT(*)::int AS c FROM customers WHERE ga_id = $1`, [gaId])
    await client.query('COMMIT')
    console.log('[dev-customer-clear] OK', {
      gaCode,
      gaId,
      before: beforeRes.rows[0]?.c ?? 0,
      deleted,
      after: afterRes.rows[0]?.c ?? 0,
    })
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
  await pool.end()
}

main().catch((e) => {
  console.error('[dev-customer-clear] failed', e instanceof Error ? e.message : e)
  process.exit(1)
})
