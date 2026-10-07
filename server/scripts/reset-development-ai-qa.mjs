/**
 * Development-only: remove AI테스트_% QA scope for one target user (no full-GA wipe).
 * Usage: node server/scripts/reset-development-ai-qa.mjs --execute --target-user tjddyd55
 */
import pool from '../db.js'
import { assertDevelopmentDatabaseOnly } from './lib/assertDevelopmentDatabase.mjs'
import { parseTargetUsername } from './lib/parseSeedCliArgs.mjs'

async function purgeUserQaScope(client, userId, gaId) {
  await client.query(
    `DELETE FROM customer_claim_request_files f
     USING customer_claim_requests r, customers c
     WHERE f.request_id = r.id AND r.customer_id = c.id
       AND c.user_id = $1 AND c.ga_id = $2 AND c.name LIKE 'AI테스트_%'`,
    [userId, gaId],
  )
  await client.query(
    `DELETE FROM customer_claim_requests r
     USING customers c
     WHERE r.customer_id = c.id AND r.agent_id = $1 AND c.name LIKE 'AI테스트_%'`,
    [userId],
  )
  await client.query(
    `DELETE FROM todos WHERE ga_id = $1 AND owner_user_id = $2 AND (title LIKE 'AI테스트_%' OR title LIKE 'AI 조회%')`,
    [gaId, userId],
  )
  const del = await client.query(
    `DELETE FROM customers WHERE ga_id = $1 AND user_id = $2 AND name LIKE 'AI테스트_%'`,
    [gaId, userId],
  )
  return { removedCustomers: del.rowCount ?? 0 }
}

async function main() {
  const execute = process.argv.includes('--execute')
  assertDevelopmentDatabaseOnly({ scriptName: 'reset-development-ai-qa', execute })
  if (!execute) {
    console.log('[reset-development-ai-qa] dry-run only — pass --execute --target-user <username>')
    process.exit(0)
  }

  const targetUsername = parseTargetUsername()
  const userRes = await pool.query(
    `SELECT id, ga_id FROM users WHERE username = $1 LIMIT 1`,
    [targetUsername],
  )
  const userId = userRes.rows[0]?.id
  const gaId = userRes.rows[0]?.ga_id
  if (!userId || gaId == null) {
    console.error('[reset-development-ai-qa] user not found', targetUsername)
    process.exit(1)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const before = await client.query(
      `SELECT COUNT(*)::int AS c FROM customers WHERE ga_id = $1 AND user_id = $2 AND name LIKE 'AI테스트_%'`,
      [gaId, userId],
    )
    const result = await purgeUserQaScope(client, userId, gaId)
    const after = await client.query(
      `SELECT COUNT(*)::int AS c FROM customers WHERE ga_id = $1 AND user_id = $2 AND name LIKE 'AI테스트_%'`,
      [gaId, userId],
    )
    await client.query('COMMIT')
    console.log('[reset-development-ai-qa] OK', {
      targetUsername,
      userId,
      gaId,
      before: before.rows[0]?.c ?? 0,
      removedCustomers: result.removedCustomers,
      after: after.rows[0]?.c ?? 0,
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
  console.error('[reset-development-ai-qa] failed', e instanceof Error ? e.message : e)
  process.exit(1)
})
