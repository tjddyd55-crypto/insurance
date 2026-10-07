/**
 * Development-only: ensure a GA USER account exists for AI Import live QA.
 * Password ONLY from env INSURANCE_GA_QA_BOOTSTRAP_PASSWORD (never commit).
 */
import pool from '../db.js'
import { isDevelopmentDbTarget, isProductionDbTarget } from '../lib/dbEnvironmentGuard.js'

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('[bootstrap-ga-qa] DATABASE_URL missing')
    process.exit(1)
  }
  if (isProductionDbTarget(connectionString)) {
    console.error('[bootstrap-ga-qa] production DB — abort')
    process.exit(1)
  }
  if (String(process.env.INSURANCE_DB_ENVIRONMENT ?? '').toLowerCase() !== 'development') {
    console.error('[bootstrap-ga-qa] INSURANCE_DB_ENVIRONMENT=development required')
    process.exit(1)
  }
  if (!String(process.env.INSURANCE_GA_QA_BOOTSTRAP_PASSWORD ?? '').trim()) {
    console.error('[bootstrap-ga-qa] INSURANCE_GA_QA_BOOTSTRAP_PASSWORD required')
    process.exit(1)
  }

  const bcrypt = (await import('bcryptjs')).default
  const { randomUUID } = await import('node:crypto')
  const username = String(process.env.INSURANCE_GA_QA_BOOTSTRAP_USERNAME ?? 'qa_ai_user').trim()
  const hash = await bcrypt.hash(process.env.INSURANCE_GA_QA_BOOTSTRAP_PASSWORD, 10)
  const gaRes = await pool.query(`SELECT id FROM ga_companies WHERE code = 'YJASSET' LIMIT 1`)
  const gaId = gaRes.rows[0]?.id
  if (gaId == null) {
    console.error('[bootstrap-ga-qa] YJASSET GA not found')
    process.exit(1)
  }
  const existing = await pool.query(`SELECT id FROM users WHERE username = $1`, [username])
  if (existing.rowCount === 0) {
    const id = randomUUID()
    await pool.query(
      `INSERT INTO users (id, username, password_hash, role, ga_id, display_name, invited_by_user_id) VALUES ($1, $2, $3, 'USER', $4, 'AI QA User', $1)`,
      [id, username, hash, gaId],
    )
    console.log('[bootstrap-ga-qa] created USER', { username, gaId })
  } else {
    await pool.query(
      `UPDATE users SET password_hash = $1, role = 'USER', ga_id = $2 WHERE username = $3`,
      [hash, gaId, username],
    )
    console.log('[bootstrap-ga-qa] updated USER', { username, gaId })
  }
  await pool.end()
  console.log('[bootstrap-ga-qa] OK')
}

main().catch((err) => {
  console.error('[bootstrap-ga-qa] failed', err instanceof Error ? err.message : err)
  process.exit(1)
})
