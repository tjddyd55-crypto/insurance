import pg from 'pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL required')
  process.exit(1)
}

const client = new pg.Client({ connectionString })
await client.connect()

const users = await client.query(`
  SELECT id, username, role, ga_id, display_name
  FROM users
  WHERE role IN ('SUPER_ADMIN', 'GA_ADMIN', 'GA_STAFF', 'INSURER_MANAGER', 'LOSS_ADJUSTER')
    AND is_deleted = false
  ORDER BY role, username
  LIMIT 30
`)

const managers = await client.query(`
  SELECT id, username, insurer_name, status, ga_id, company_id
  FROM insurer_managers
  WHERE is_deleted = false
  ORDER BY username
  LIMIT 30
`)

const newsletters = await client.query(`
  SELECT COUNT(*)::int AS count
  FROM insurance_company_newsletters
`)

const pushDevices = await client.query(`
  SELECT user_id, platform, app_package, is_active, left(device_token, 8) AS token_prefix, installation_id
  FROM user_push_devices
  WHERE app_package = 'com.onefc.app.dev'
  ORDER BY updated_at DESC
  LIMIT 10
`)

const pushUser = await client.query(`
  SELECT id, username, display_name, role, ga_id
  FROM users
  WHERE id = '5c2d72a2-7b4d-4b5f-a505-81d5e5018e87'
`)

const recentNews = await client.query(`
  SELECT id, title, status, ga_id, payload->>'channel' AS channel, created_at
  FROM insurance_company_newsletters
  ORDER BY created_at DESC
  LIMIT 10
`)

const feedVisibleCount = await client.query(`
  SELECT COUNT(*)::int AS count
  FROM insurance_company_newsletters n
  WHERE n.ga_id = 1
    AND n.status = 'PUBLISHED'
    AND n.deleted_at IS NULL
    AND COALESCE(NULLIF(TRIM(n.payload->>'newsChannel'), ''), 'INSURER') = 'INSURER'
    AND COALESCE((n.payload->>'customerVisible')::boolean, false) = false
    AND COALESCE(NULLIF(TRIM(n.payload->>'insurerSlug'), ''), '') <> 'customer-news'
`)

const 박성용 = await client.query(`
  SELECT id, username, display_name, role, ga_id
  FROM users
  WHERE display_name LIKE '%박성용%' OR username LIKE '%박%'
  LIMIT 5
`)

console.log(
  JSON.stringify(
    {
      users: users.rows,
      managers: managers.rows,
      newsletterCount: newsletters.rows[0],
      pushDevices: pushDevices.rows,
      pushUser: pushUser.rows,
      recentNews: recentNews.rows,
      feedVisibleCount: feedVisibleCount.rows[0],
      parkUsers: 박성용.rows,
    },
    null,
    2,
  ),
)
await client.end()
