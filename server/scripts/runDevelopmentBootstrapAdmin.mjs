/**
 * Development Postgres에서만 bootstrap SUPER_ADMIN(admin) 비밀번호·역할을 갱신한다.
 * 비밀번호는 INSURANCE_ADMIN_BOOTSTRAP_PASSWORD 환경변수로만 전달한다(소스·Git 금지).
 */
import pool from '../db.js'
import { isDevelopmentDbTarget, isProductionDbTarget } from '../lib/dbEnvironmentGuard.js'
async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('[bootstrap-admin] DATABASE_URL 없음')
    process.exit(1)
  }
  if (isProductionDbTarget(connectionString)) {
    console.error('[bootstrap-admin] production DB — 중단')
    process.exit(1)
  }
  const explicitDev = String(process.env.INSURANCE_DB_ENVIRONMENT ?? '').toLowerCase() === 'development'
  if (!explicitDev && !isDevelopmentDbTarget(connectionString)) {
    console.error('[bootstrap-admin] development DB가 아님 — INSURANCE_DB_ENVIRONMENT=development 확인')
    process.exit(1)
  }
  if (process.env.INSURANCE_ENABLE_ADMIN_BOOTSTRAP !== 'true') {
    console.error('[bootstrap-admin] INSURANCE_ENABLE_ADMIN_BOOTSTRAP=true 필요')
    process.exit(1)
  }
  if (!String(process.env.INSURANCE_ADMIN_BOOTSTRAP_PASSWORD ?? '').trim()) {
    console.error('[bootstrap-admin] INSURANCE_ADMIN_BOOTSTRAP_PASSWORD 환경변수 필요')
    process.exit(1)
  }

  const bcrypt = (await import('bcryptjs')).default
  const { randomUUID } = await import('node:crypto')
  const username = String(process.env.INSURANCE_ADMIN_BOOTSTRAP_USERNAME || 'admin').trim()
  const password = process.env.INSURANCE_ADMIN_BOOTSTRAP_PASSWORD
  const hash = await bcrypt.hash(password, 10)
  const gaRes = await pool.query(`SELECT id FROM ga_companies WHERE code = 'YJASSET' LIMIT 1`)
  const gaId = gaRes.rows[0]?.id
  if (gaId == null) {
    console.error('[bootstrap-admin] YJASSET GA 없음')
    process.exit(1)
  }
  const existing = await pool.query(`SELECT id FROM users WHERE username = $1`, [username])
  if (existing.rowCount === 0) {
    await pool.query(
      `INSERT INTO users (id, username, password_hash, role, ga_id) VALUES ($1, $2, $3, 'SUPER_ADMIN', $4)`,
      [randomUUID(), username, hash, gaId],
    )
    console.log('[bootstrap-admin] admin 생성 완료')
  } else {
    await pool.query(
      `UPDATE users SET password_hash = $1, role = 'SUPER_ADMIN', ga_id = $3 WHERE username = $2`,
      [hash, username, gaId],
    )
    console.log('[bootstrap-admin] admin 비밀번호·역할 갱신 완료')
  }
  const row = await pool.query(`SELECT username, role, is_deleted FROM users WHERE username = $1 LIMIT 1`, [username])
  console.log('[bootstrap-admin] OK', {
    username: row.rows[0].username,
    role: row.rows[0].role,
    is_deleted: row.rows[0].is_deleted,
  })
  await pool.end()
}

main().catch((err) => {
  console.error('[bootstrap-admin] 실패', err instanceof Error ? err.message : err)
  process.exit(1)
})
