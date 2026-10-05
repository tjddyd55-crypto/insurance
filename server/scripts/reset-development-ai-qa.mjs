/**
 * Development-only: clear YJASSET business data before AI read-only QA seed.
 * Usage: INSURANCE_DB_ENVIRONMENT=development node server/scripts/reset-development-ai-qa.mjs --execute
 */
import pool from '../db.js'
import { assertDevelopmentDatabaseOnly } from './lib/assertDevelopmentDatabase.mjs'

const GA_CODE = String(process.env.INSURANCE_DEV_CLEAR_GA_CODE ?? 'YJASSET').trim()

async function main() {
  const execute = process.argv.includes('--execute')
  assertDevelopmentDatabaseOnly({ scriptName: 'reset-development-ai-qa', execute })
  if (!execute) {
    console.log('[reset-development-ai-qa] dry-run only — pass --execute to mutate')
    process.exit(0)
  }

  const gaRes = await pool.query(`SELECT id, code FROM ga_companies WHERE code = $1 LIMIT 1`, [GA_CODE])
  const gaId = gaRes.rows[0]?.id
  if (!gaId) {
    console.error('[reset-development-ai-qa] GA not found', GA_CODE)
    process.exit(1)
  }

  const client = await pool.connect()
  const counts = {}
  try {
    await client.query('BEGIN')

    const snap = async (label, sql, params = [gaId]) => {
      const r = await client.query(sql, params)
      counts[label] = Number(r.rows[0]?.c ?? 0)
    }

    await snap('customers_before', `SELECT COUNT(*)::int AS c FROM customers WHERE ga_id = $1`)
    await snap('todos_before', `SELECT COUNT(*)::int AS c FROM todos WHERE ga_id = $1`)

    await client.query(
      `DELETE FROM customer_claim_request_files f
       USING customer_claim_requests r
       WHERE f.request_id = r.id AND r.agent_id IN (SELECT id FROM users WHERE ga_id = $1)`,
      [gaId],
    )
    await client.query(
      `DELETE FROM customer_claim_requests WHERE agent_id IN (SELECT id FROM users WHERE ga_id = $1)`,
      [gaId],
    )
    await client.query(`DELETE FROM todos WHERE ga_id = $1`, [gaId])
    await client.query(`DELETE FROM folders WHERE ga_id = $1 AND customer_id IS NOT NULL`, [gaId])
    await client.query(`DELETE FROM insurance_forms WHERE ga_id = $1`, [gaId])
    await client.query(`DELETE FROM customers WHERE ga_id = $1`, [gaId])

    await snap('customers_after', `SELECT COUNT(*)::int AS c FROM customers WHERE ga_id = $1`)
    await snap('todos_after', `SELECT COUNT(*)::int AS c FROM todos WHERE ga_id = $1`)

    await client.query('COMMIT')
    console.log('[reset-development-ai-qa] OK', { gaCode: GA_CODE, gaId, counts })
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
  await pool.end()
}

main().catch((e) => {
  console.error('[reset-development-ai-qa] failed', e instanceof Error ? e.message : e)
  process.exit(1)
})
