import pool from '../db.js'
import { listCustomersForAssistant } from '../ai-assistant/read-tools/customerListReadService.js'
import { parseTargetUsername } from './lib/parseSeedCliArgs.mjs'

const username = parseTargetUsername()
const userRes = await pool.query(`SELECT id, username, role, ga_id FROM users WHERE username = $1`, [username])
const row = userRes.rows[0]
if (!row) {
  console.error('user not found', username)
  process.exit(1)
}
const req = {
  user: {
    id: row.id,
    userId: row.id,
    gaId: row.ga_id,
    customerAccess: 'own',
  },
}
const list = await listCustomersForAssistant(pool, req, { limit: 20 })
const count = await listCustomersForAssistant(pool, req, { countOnly: true })
console.log(
  JSON.stringify({
    username: row.username,
    userId: row.id,
    gaId: row.ga_id,
    role: row.role,
    listTotal: list.total,
    listShown: list.customers.length,
    countOnlyTotal: count.total,
  }),
)
await pool.end()
