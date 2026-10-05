import pg from 'pg'
import { enqueuePushOutbox, processPendingPushOutbox } from '../lib/push/pushOutboxService.js'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL required')
  process.exit(1)
}

const USER_ID = process.env.QA_PUSH_USER_ID || '5c2d72a2-7b4d-4b5f-a505-81d5e5018e87'
const GA_ID = 1
const title = process.env.QA_PUSH_TITLE || 'ONE FC Push 테스트'
const body = process.env.QA_PUSH_BODY || 'DEV Push 수신 테스트입니다.'
const dedupeKey = process.env.QA_PUSH_DEDUPE || `dev-qa-push-${Date.now()}`
let data = {}
if (process.env.QA_PUSH_DATA_JSON) {
  data = JSON.parse(process.env.QA_PUSH_DATA_JSON)
}

const pool = new pg.Pool({ connectionString, max: 3 })
const outboxId = await enqueuePushOutbox(pool, {
  gaId: GA_ID,
  notificationId: null,
  recipientUserId: USER_ID,
  eventType: 'DEV_QA_PUSH',
  dedupeKey,
  payload: { title, body, data },
})
const send = await processPendingPushOutbox(pool, { limit: 5 })
console.log(JSON.stringify({ outboxId, send, dedupeKey }, null, 2))
await pool.end()
