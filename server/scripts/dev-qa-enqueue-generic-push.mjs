import pg from 'pg'
import { enqueuePushOutbox, processPendingPushOutbox } from '../lib/push/pushOutboxService.js'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL required')
  process.exit(1)
}

const USER_ID = process.env.QA_PUSH_USER_ID || '5c2d72a2-7b4d-4b5f-a505-81d5e5018e87'
const GA_ID = 1
const dedupeKey = `dev-qa-generic-push-${new Date().toISOString().slice(0, 13)}`

const pool = new pg.Pool({ connectionString, max: 3 })
const outboxId = await enqueuePushOutbox(pool, {
  gaId: GA_ID,
  notificationId: null,
  recipientUserId: USER_ID,
  eventType: 'GENERIC_QA_PUSH',
  dedupeKey,
  payload: {
    title: 'ONE FC Push \uD14C\uC2A4\uD2B8',
    body: 'DEV Push \uC218\uC2E0 \uD14C\uC2A4\uD2B8\uC785\uB2C8\uB2E4.',
    data: { type: 'generic_qa' },
  },
})
const send = await processPendingPushOutbox(pool, { limit: 5 })
const devices = await pool.query(
  `SELECT platform, app_package, is_active, left(device_token,8) AS token_prefix, installation_id
   FROM user_push_devices WHERE user_id=$1 AND app_package='com.onefc.app.dev'`,
  [USER_ID],
)
console.log(JSON.stringify({ outboxId, send, devices: devices.rows }, null, 2))
await pool.end()
