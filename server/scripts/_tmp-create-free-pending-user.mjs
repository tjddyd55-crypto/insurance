import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import pg from 'pg'

const username = process.env.QA_FREE_USERNAME?.trim() || `qa-free-ent-v2-${Date.now()}`
const password = process.env.QA_FREE_PASSWORD?.trim() || 'QaFreeEnt1!'
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : undefined,
})

const client = await pool.connect()
try {
  await client.query('BEGIN')
  const gaRes = await client.query(
    `SELECT id, code, name FROM ga_companies WHERE UPPER(TRIM(code)) = 'GENERAL' AND is_deleted = false LIMIT 1`,
  )
  const ga = gaRes.rows[0]
  if (!ga) throw new Error('GENERAL ga missing')

  const userId = randomUUID()
  const passwordHash = await bcrypt.hash(password, 10)
  await client.query(
    `
    INSERT INTO users (id, username, password_hash, role, ga_id, display_name, phone_number, invited_by_user_id, status)
    VALUES ($1, $2, $3, 'USER', $4, $5, $6, $1, 'active')
    `,
    [userId, username, passwordHash, ga.id, 'QA FREE GENERAL v2', `010${String(Date.now()).slice(-8)}`],
  )

  const tenantRes = await client.query(
    `SELECT id, industry_id FROM tenants WHERE legacy_ga_id = $1 ORDER BY id ASC LIMIT 1`,
    [ga.id],
  )
  const tenant = tenantRes.rows[0]
  if (tenant?.id) {
    await client.query(
      `
      INSERT INTO user_memberships (user_id, tenant_id, industry_id, rbac_role, membership_type, customer_access, scope_id)
      VALUES ($1, $2, $3, 'user', 'agent', 'own', $4)
      ON CONFLICT DO NOTHING
      `,
      [userId, tenant.id, tenant.industry_id, String(tenant.id)],
    )
  }

  await client.query(
    `
    INSERT INTO billing_subscriptions (user_id, tenant_id, plan_code, status, billing_cycle, created_at, updated_at)
    VALUES ($1, $2, 'insurance_basic', 'pending_payment', 'monthly', NOW(), NOW())
    `,
    [userId, tenant?.id ?? null],
  )

  await client.query('COMMIT')
  console.log(
    JSON.stringify(
      { username, password, userId, gaCode: ga.code, billingStatus: 'pending_payment' },
      null,
      2,
    ),
  )
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}
