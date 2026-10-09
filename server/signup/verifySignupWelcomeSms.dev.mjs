/**
 * DEV 회원가입 환영 SMS mock 검증 (Railway development).
 *
 *   railway run --environment development --service app node server/signup/verifySignupWelcomeSms.dev.mjs
 */
import pg from 'pg'
import {
  buildSignupWelcomeSmsMessage,
  formatOnefcSupportPhoneDisplay,
  queueSignupWelcomeSms,
} from './signupWelcomeSms.js'
import { isDevSignupPhoneBypassEnabled, resolveDevSignupPhoneForStorage } from '../lib/devSignupPhoneBypass.js'

const BASE = String(process.env.VERIFY_SIGNUP_WELCOME_BASE_URL ?? 'https://insurance-dev.up.railway.app').replace(
  /\/$/,
  '',
)
const REGISTER_URL = `${BASE}/backend/register`

function randomSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10)
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const username = `welcomesms${randomSuffix()}`
  const password = 'TestPass9!'
  const displayName = '환영SMS검증'
  const enteredPhone = '01090001234'

  const res = await fetch(REGISTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password,
      name: displayName,
      phone_number: enteredPhone,
    }),
  })
  const json = await res.json().catch(() => ({}))
  console.log('[verify] register', res.status, { id: json.id, username: json.username })

  if (res.status !== 201) {
    console.log('[verify] body', json)
    process.exitCode = 1
    await pool.end()
    return
  }

  const userId = String(json.id ?? '')
  const storedRow = await pool.query(`SELECT phone_number FROM users WHERE id = $1`, [userId])
  const storedPhone = String(storedRow.rows[0]?.phone_number ?? '').replace(/\D/g, '')
  const bypass = isDevSignupPhoneBypassEnabled()
  const enteredDigits = enteredPhone.replace(/\D/g, '')

  console.log('[verify] phones', {
    enteredPhone: enteredDigits,
    storedPhone,
    expectedStoredIfBypass: bypass ? resolveDevSignupPhoneForStorage(enteredDigits, username) : enteredDigits,
    welcomeSmsTargetInCode: enteredDigits,
    devBypass: bypass,
  })

  console.log('[verify] message preview:\n' + buildSignupWelcomeSmsMessage())
  console.log('[verify] support', formatOnefcSupportPhoneDisplay())

  let logRes = await pool.query(
    `SELECT user_id, phone_number, status, provider FROM signup_welcome_sms_log WHERE user_id = $1`,
    [userId],
  )
  console.log('[verify] log immediate', logRes.rows)

  await new Promise((r) => setTimeout(r, 3000))
  logRes = await pool.query(
    `SELECT user_id, phone_number, status, provider FROM signup_welcome_sms_log WHERE user_id = $1`,
    [userId],
  )
  console.log('[verify] log after send', logRes.rows)

  queueSignupWelcomeSms(pool, { userId, phoneNumber: enteredDigits })
  await new Promise((r) => setTimeout(r, 1500))
  const countRes = await pool.query(`SELECT COUNT(*)::int AS n FROM signup_welcome_sms_log WHERE user_id = $1`, [userId])
  console.log('[verify] log row count after duplicate queue', countRes.rows[0]?.n)
  console.log('[verify] test user id for cleanup', userId)

  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
