#!/usr/bin/env node
/**
 * 추천인 관계 보정 — 회원가입 legacy 추천 코드 플로우와 동일한 service 함수를 재사용한다.
 *
 * Usage:
 *   node scripts/repair-referral-by-login.js --referrer <loginId> --target <loginId> [--target <loginId> ...]
 *
 * 기본(dry-run): SELECT 감사 출력만. DB 변경 없음.
 * --execute --confirm: 트랜잭션으로 보정 실행.
 *
 * production execute 는 추가로 INSURANCE_ALLOW_PRODUCTION_REFERRAL_REPAIR=I_UNDERSTAND 필요.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

import { assertSafeForMutatingScript } from '../server/lib/dbEnvironmentGuard.js'
import { ensureReferralCodeForUser } from '../server/referrals/referralCode.js'
import {
  loadUserReferralAuditByUsername,
  repairReferralRelationship,
  validateReferralCodeForSignup,
} from '../server/referrals/referralService.js'
import { readPolicyActive } from '../server/subscription/appSettings.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

function loadEnvFileIfPresent(root, filename = '.env') {
  const p = path.join(root, filename)
  if (!fs.existsSync(p)) {
    return
  }
  const raw = fs.readFileSync(p, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) {
      continue
    }
    const eq = t.indexOf('=')
    if (eq <= 0) {
      continue
    }
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = val
    }
  }
}

loadEnvFileIfPresent(path.join(projectRoot, 'server'), '.env')
loadEnvFileIfPresent(path.join(projectRoot, 'server'), '.env.local')

function printUsage() {
  console.error(`Usage:
  node scripts/repair-referral-by-login.js --referrer <loginId> --target <loginId> [--target <loginId> ...]

Options:
  --execute --confirm    Apply changes in a transaction (default: dry-run only)
  --help                 Show this help

Production execute additionally requires:
  INSURANCE_ALLOW_PRODUCTION_REFERRAL_REPAIR=I_UNDERSTAND
`)
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const flags = new Set()
  let referrerLoginId = ''
  /** @type {string[]} */
  const targetLoginIds = []

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--referrer') {
      referrerLoginId = String(argv[++i] ?? '').trim()
      continue
    }
    if (arg === '--target') {
      const loginId = String(argv[++i] ?? '').trim()
      if (loginId) {
        targetLoginIds.push(loginId)
      }
      continue
    }
    if (arg.startsWith('--')) {
      flags.add(arg)
    }
  }

  return {
    help: flags.has('--help'),
    execute: flags.has('--execute'),
    confirm: flags.has('--confirm'),
    referrerLoginId,
    targetLoginIds: [...new Set(targetLoginIds)],
    allowProduction:
      String(process.env.INSURANCE_ALLOW_PRODUCTION_REFERRAL_REPAIR ?? '').trim() === 'I_UNDERSTAND',
  }
}

function printAudit(label, audit) {
  console.log(`\n=== ${label} ===`)
  if (!audit) {
    console.log('(사용자 없음)')
    return
  }
  const u = audit.user
  console.log(
    JSON.stringify(
      {
        id: u.id,
        username: u.username,
        display_name: u.display_name,
        role: u.role,
        status: u.status,
        ga_id: u.ga_id,
        ga_name: u.ga_name,
        ga_code: u.ga_code,
        own_referral_code: audit.ownReferralCode?.code ?? null,
        referred_by: audit.referredBy
          ? {
              relationship_id: audit.referredBy.id,
              referrer_user_id: audit.referredBy.referrer_user_id,
              referrer_username: audit.referredBy.referrer_username,
              referrer_display_name: audit.referredBy.referrer_display_name,
              code: audit.referredBy.code,
              status: audit.referredBy.status,
              created_at: audit.referredBy.created_at,
            }
          : null,
        referred_users_count: audit.referredUsers.length,
      },
      null,
      2,
    ),
  )
}

async function resolveUserIdByLogin(client, loginId) {
  const r = await client.query(
    `
    SELECT id, username, display_name
    FROM users
    WHERE LOWER(TRIM(username)) = LOWER(TRIM($1))
      AND is_deleted = false
    LIMIT 1
    `,
    [loginId],
  )
  return r.rows[0] ?? null
}

async function auditAll(pool, referrerLoginId, targetLoginIds) {
  const referrerAudit = await loadUserReferralAuditByUsername(pool, referrerLoginId)
  printAudit(`referrer @${referrerLoginId}`, referrerAudit)

  if (referrerAudit?.ownReferralCode?.code) {
    console.log(`\n[referrer code] ${referrerAudit.ownReferralCode.code}`)
  } else {
    console.log('\n[referrer code] (없음 — execute 시 ensureReferralCodeForUser 로 생성 시도)')
  }

  for (const loginId of targetLoginIds) {
    const audit = await loadUserReferralAuditByUsername(pool, loginId)
    printAudit(`target @${loginId}`, audit)
  }
}

async function repairOne(client, { loginId, referrerUserId, referrerCode, policyActive, execute, referrerLoginId }) {
  const user = await resolveUserIdByLogin(client, loginId)
  if (!user) {
    throw new Error(`target user not found: ${loginId}`)
  }

  const existingRes = await client.query(
    `SELECT referrer_user_id, code FROM referral_relationships WHERE referred_user_id = $1 LIMIT 1`,
    [user.id],
  )
  const existing = existingRes.rows[0]

  if (
    existing &&
    String(existing.referrer_user_id) === String(referrerUserId) &&
    String(existing.code).toUpperCase() === String(referrerCode).toUpperCase()
  ) {
    console.log(`[skip] ${loginId} — 이미 @${referrerLoginId} 추천 관계와 동일`)
    return 'noop'
  }

  if (!execute) {
    console.log(
      `[plan] ${loginId}: referral_relationships → referrer=${referrerUserId}, code=${referrerCode}`,
    )
    return 'planned'
  }

  const action = await repairReferralRelationship(client, {
    referredUserId: user.id,
    referrerUserId,
    code: referrerCode,
    policyActive,
  })
  console.log(`[done] ${loginId}: ${action}`)
  return action
}

async function main() {
  const { help, execute, confirm, referrerLoginId, targetLoginIds, allowProduction } = parseArgs(
    process.argv.slice(2),
  )

  if (help) {
    printUsage()
    process.exit(0)
  }

  if (!referrerLoginId || targetLoginIds.length === 0) {
    printUsage()
    console.error('\n--referrer 와 --target(1개 이상) 이 필요합니다.')
    process.exit(1)
  }

  const connectionString = process.env.DATABASE_URL
  assertSafeForMutatingScript({
    connectionString,
    execute: execute && confirm,
    scriptName: 'repair-referral-by-login',
    allowProductionExecute: allowProduction,
  })

  if (execute && !confirm) {
    console.error('--execute 는 --confirm 과 함께 사용하세요.')
    process.exit(1)
  }

  const pool = new pg.Pool({ connectionString })

  try {
    console.log(`mode=${execute && confirm ? 'EXECUTE' : 'DRY-RUN'}`)
    await auditAll(pool, referrerLoginId, targetLoginIds)

    const client = await pool.connect()
    try {
      const referrer = await resolveUserIdByLogin(client, referrerLoginId)
      if (!referrer) {
        throw new Error(`referrer not found: ${referrerLoginId}`)
      }

      const policyActive = await readPolicyActive()
      let referrerCode = ''

      if (execute && confirm) {
        await client.query('BEGIN')
        referrerCode = await ensureReferralCodeForUser(client, referrer.id)
        const validated = await validateReferralCodeForSignup(client, referrerCode)
        if (!validated.ok || !validated.referrerUserId || !validated.code) {
          throw new Error(`referrer code invalid for ${referrerLoginId}`)
        }
        if (String(validated.referrerUserId) !== String(referrer.id)) {
          throw new Error('referrer code owner mismatch')
        }
        referrerCode = validated.code
      } else {
        const codeRes = await client.query(
          `SELECT code FROM referral_codes WHERE owner_user_id = $1 LIMIT 1`,
          [referrer.id],
        )
        referrerCode = codeRes.rows[0]?.code ? String(codeRes.rows[0].code) : '(missing — execute 시 생성)'
      }

      console.log(`\n[referrer] id=${referrer.id} username=${referrer.username} code=${referrerCode}`)

      const results = []
      for (const loginId of targetLoginIds) {
        const result = await repairOne(client, {
          loginId,
          referrerUserId: referrer.id,
          referrerCode: typeof referrerCode === 'string' && referrerCode.startsWith('(') ? '' : referrerCode,
          policyActive,
          execute: execute && confirm,
          referrerLoginId,
        })
        results.push({ loginId, result })
      }

      if (execute && confirm) {
        await client.query('COMMIT')
        console.log('\n=== post-repair audit ===')
        await auditAll(pool, referrerLoginId, targetLoginIds)
      }

      console.log('\n=== summary ===')
      console.log(JSON.stringify(results, null, 2))
    } catch (e) {
      if (execute && confirm) {
        try {
          await client.query('ROLLBACK')
        } catch {
          /* */
        }
      }
      throw e
    } finally {
      client.release()
    }
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
