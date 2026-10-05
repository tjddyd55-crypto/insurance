import pg from 'pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL required')
  process.exit(1)
}

const client = new pg.Client({ connectionString })
await client.connect()
const res = await client.query(
  `SELECT username, role, display_name FROM users WHERE role IN ('USER', 'GA_STAFF') ORDER BY role, username LIMIT 20`,
)
console.table(res.rows)
await client.end()
