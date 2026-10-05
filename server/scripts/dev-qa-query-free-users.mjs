import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const users = await pool.query(`
  SELECT
    u.id,
    u.username,
    g.code AS ga_code,
    g.name AS ga_name,
    bs.status AS billing_status,
    bs.trial_ends_at,
    bs.plan_code
  FROM users u
  LEFT JOIN ga_companies g ON g.id = u.ga_id
  LEFT JOIN billing_subscriptions bs ON bs.user_id = u.id
  WHERE u.role = 'USER'
  ORDER BY u.created_at DESC NULLS LAST
  LIMIT 30
`)

const counts = await pool.query(`
  SELECT
    COUNT(*) FILTER (WHERE bs.id IS NULL) AS no_subscription,
    COUNT(*) FILTER (WHERE bs.status IN ('trialing', 'trial')) AS trialing,
    COUNT(*) FILTER (WHERE bs.status IN ('active_paid', 'paid', 'active')) AS paid,
    COUNT(*) FILTER (WHERE g.code = 'GENERAL' OR g.name ILIKE '%공용%') AS general_users,
    COUNT(*) AS total_users
  FROM users u
  LEFT JOIN ga_companies g ON g.id = u.ga_id
  LEFT JOIN billing_subscriptions bs ON bs.user_id = u.id
  WHERE u.role = 'USER'
`)

const freeUsers = await pool.query(`
  SELECT u.id, u.username, g.code AS ga_code, g.name AS ga_name
  FROM users u
  LEFT JOIN ga_companies g ON g.id = u.ga_id
  LEFT JOIN billing_subscriptions bs ON bs.user_id = u.id
  WHERE u.role = 'USER'
    AND bs.id IS NULL
    AND (g.code = 'GENERAL' OR g.name ILIKE '%공용%')
  ORDER BY u.username ASC
`)

const noSubUsers = await pool.query(`
  SELECT u.id, u.username, g.code AS ga_code, g.name AS ga_name
  FROM users u
  LEFT JOIN ga_companies g ON g.id = u.ga_id
  LEFT JOIN billing_subscriptions bs ON bs.user_id = u.id
  WHERE u.role = 'USER' AND bs.id IS NULL
  ORDER BY u.username ASC
`)

console.log(
  JSON.stringify(
    { counts: counts.rows[0], freeUsers: freeUsers.rows, noSubUsers: noSubUsers.rows },
    null,
    2,
  ),
)
await pool.end()
