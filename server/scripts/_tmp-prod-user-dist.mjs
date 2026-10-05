import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const result = await pool.query(`
  SELECT
    COUNT(*) FILTER (WHERE bs.id IS NULL) AS no_subscription,
    COUNT(*) FILTER (WHERE bs.status IN ('trialing', 'trial')) AS trialing,
    COUNT(*) FILTER (
      WHERE bs.status IN ('active_paid', 'paid', 'active', 'active_manual', 'legacy_active', 'free')
    ) AS paid_like,
    COUNT(*) FILTER (WHERE bs.status = 'pending_payment') AS pending_payment,
    COUNT(*) FILTER (WHERE g.code = 'GENERAL' OR g.name ILIKE '%공용%') AS general_users,
    COUNT(*) FILTER (
      WHERE (g.code = 'GENERAL' OR g.name ILIKE '%공용%')
        AND bs.status IN ('pending_payment')
    ) AS general_pending_payment,
    COUNT(*) AS total_users
  FROM users u
  LEFT JOIN ga_companies g ON g.id = u.ga_id
  LEFT JOIN billing_subscriptions bs ON bs.user_id = u.id
  WHERE u.role = 'USER'
    AND COALESCE(u.is_deleted, false) = false
`)

console.log(JSON.stringify(result.rows[0], null, 2))
await pool.end()
