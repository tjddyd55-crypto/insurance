/**
 * App Store / Google Play 심사용 공용 계정 프로비저닝 (가입 플로우 우회).
 * 비밀번호는 호출 인자로만 받으며 로그·Git에 남기지 않는다.
 */
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { INSURANCE_BASIC_PLAN_CODE } from '../insurance-billing/config.js'
import { normalizeKrMobile, validateKrMobileDigits } from '../lib/phoneNormalize.js'
import {
  assertSafeForMutatingScript,
  isProductionDbTarget,
} from '../lib/dbEnvironmentGuard.js'

export const STORE_REVIEW_GA_CODE = 'PLAY_REVIEW'
export const STORE_REVIEW_GA_NAME = 'Google Play Review'
export const STORE_REVIEW_TENANT_CODE = 'play_review'
export const STORE_REVIEW_INDUSTRY_CODE = 'insurance'

/** @type {Record<string, { username: string; displayName: string; phone: string; label: string }>} */
export const STORE_REVIEW_PROFILES = Object.freeze({
  google: {
    username: 'google_review',
    displayName: 'Google Review',
    phone: '01099990001',
    label: 'google-play',
  },
  apple: {
    username: 'apple_review',
    displayName: 'Apple Review',
    phone: '01099990002',
    label: 'app-store',
  },
})

const REVIEW_TRIAL_DAYS = 30

function reviewTrialEndsIso(now = new Date()) {
  return new Date(now.getTime() + REVIEW_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * @param {string} profileKey
 */
export function resolveStoreReviewProfile(profileKey) {
  const key = String(profileKey ?? '').trim().toLowerCase()
  const profile = STORE_REVIEW_PROFILES[key]
  if (!profile) {
    throw new Error(`[store-review] unknown profile "${profileKey}". Use: google | apple`)
  }
  return { key, ...profile }
}

/**
 * @param {{ execute?: boolean; scriptName?: string; env?: NodeJS.ProcessEnv }} [options]
 */
export function assertStoreReviewProductionGuard(options = {}) {
  const execute = Boolean(options.execute)
  const env = options.env ?? process.env
  const connectionString = env.DATABASE_URL ?? ''
  const allowProductionExecute =
    env.INSURANCE_ALLOW_PRODUCTION_STORE_REVIEW === 'I_UNDERSTAND' ||
    env.INSURANCE_ALLOW_PRODUCTION_GOOGLE_PLAY_REVIEW === 'I_UNDERSTAND'

  assertSafeForMutatingScript({
    connectionString,
    execute,
    scriptName: options.scriptName ?? 'provision-store-review-account',
    env,
    allowProductionExecute,
  })

  if (execute && isProductionDbTarget(connectionString, env)) {
    const yj = String(env.STORE_REVIEW_BLOCK_YJASSET ?? '1').trim()
    if (yj !== '0') {
      console.warn('[store-review] YJASSET 연결 금지 가드 활성')
    }
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ execute: boolean; label: string }} options
 */
async function resolveReviewGaAndTenant(executor, { execute, label }) {
  const industryR = await systemQuery(
    executor,
    `SELECT id FROM industries WHERE code = $1 AND status = 'active' LIMIT 1`,
    [STORE_REVIEW_INDUSTRY_CODE],
  )
  const industryId = industryR.rows[0]?.id
  if (industryId == null) {
    throw new Error(`[${label}] industry "${STORE_REVIEW_INDUSTRY_CODE}" 가 없습니다.`)
  }

  const gaR = await systemQuery(
    executor,
    `
    SELECT id, code, name, status
    FROM ga_companies
    WHERE UPPER(TRIM(code)) = $1 AND is_deleted = false
    LIMIT 1
    `,
    [STORE_REVIEW_GA_CODE],
  )
  let gaId = gaR.rows[0]?.id
  let gaCreated = false

  if (gaId == null) {
    if (!execute) {
      return {
        gaId: null,
        gaCode: STORE_REVIEW_GA_CODE,
        tenantId: null,
        tenantCode: STORE_REVIEW_TENANT_CODE,
        industryId: Number(industryId),
        gaCreated: false,
        tenantCreated: false,
        wouldCreateGa: true,
        wouldCreateTenant: true,
      }
    }
    const insGa = await systemQuery(
      executor,
      `
      INSERT INTO ga_companies (name, code, status, is_deleted)
      VALUES ($1, $2, 'active', false)
      RETURNING id, code, name
      `,
      [STORE_REVIEW_GA_NAME, STORE_REVIEW_GA_CODE],
    )
    gaId = insGa.rows[0]?.id
    gaCreated = true
  }

  const tenantR = await systemQuery(
    executor,
    `
    SELECT id, code, name, legacy_ga_id
    FROM tenants
    WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))
    LIMIT 1
    `,
    [STORE_REVIEW_TENANT_CODE],
  )
  let tenantId = tenantR.rows[0]?.id
  let tenantCreated = false

  if (tenantId == null) {
    if (!execute) {
      return {
        gaId: Number(gaId),
        gaCode: STORE_REVIEW_GA_CODE,
        tenantId: null,
        tenantCode: STORE_REVIEW_TENANT_CODE,
        industryId: Number(industryId),
        gaCreated,
        tenantCreated: false,
        wouldCreateTenant: true,
      }
    }
    const insTenant = await systemQuery(
      executor,
      `
      INSERT INTO tenants (industry_id, code, name, status, legacy_ga_id, r2_key_prefix, config)
      VALUES ($1, $2, $3, 'active', $4, $5, '{}'::jsonb)
      RETURNING id, code
      `,
      [
        industryId,
        STORE_REVIEW_TENANT_CODE,
        'Store Review',
        gaId,
        `crm-platform/{environment}/insurance/tenants/${STORE_REVIEW_TENANT_CODE}`,
      ],
    )
    tenantId = insTenant.rows[0]?.id
    tenantCreated = true
  } else if (Number(tenantR.rows[0]?.legacy_ga_id) !== Number(gaId)) {
    throw new Error(
      `[${label}] tenant "${STORE_REVIEW_TENANT_CODE}" 가 다른 GA(id=${tenantR.rows[0]?.legacy_ga_id})에 연결되어 있습니다.`,
    )
  }

  const yjR = await systemQuery(
    executor,
    `SELECT id FROM ga_companies WHERE UPPER(TRIM(code)) = 'YJASSET' AND is_deleted = false LIMIT 1`,
  )
  const yjId = yjR.rows[0]?.id
  if (yjId != null && Number(gaId) === Number(yjId)) {
    throw new Error(`[${label}] PLAY_REVIEW GA 가 YJASSET 와 동일합니다. 중단합니다.`)
  }

  return {
    gaId: Number(gaId),
    gaCode: STORE_REVIEW_GA_CODE,
    tenantId: Number(tenantId),
    tenantCode: STORE_REVIEW_TENANT_CODE,
    industryId: Number(industryId),
    gaCreated,
    tenantCreated,
    wouldCreateGa: false,
    wouldCreateTenant: false,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} phoneDigits
 * @param {string | null | undefined} excludeUserId
 * @param {{ allowReviewSiblingRelease?: boolean }} [options]
 */
async function assertPhoneAvailableForUserRole(executor, phoneDigits, excludeUserId = null, options = {}) {
  const params = [phoneDigits]
  let sql = `
    SELECT id, username
    FROM users
    WHERE is_deleted = false
      AND role = 'USER'
      AND regexp_replace(COALESCE(phone_number, ''), '[^0-9]', '', 'g') = $1
  `
  if (excludeUserId) {
    sql += ` AND id <> $2`
    params.push(excludeUserId)
  }
  sql += ' LIMIT 1'
  const dup = await systemQuery(executor, sql, params)
  if (dup.rowCount === 0) {
    return
  }

  const blocker = dup.rows[0]
  if (
    options.allowReviewSiblingRelease &&
    blocker?.username === 'google_review' &&
    phoneDigits === STORE_REVIEW_PROFILES.apple.phone
  ) {
    const googlePhone = normalizeKrMobile(STORE_REVIEW_PROFILES.google.phone)
    await systemQuery(
      executor,
      `
      UPDATE users
      SET phone_number = $2
      WHERE id = $1 AND username = 'google_review' AND is_deleted = false
      `,
      [blocker.id, googlePhone],
    )
    return
  }

  throw new Error(
    `[store-review] phone ${phoneDigits} 는 USER 계정 "${blocker?.username}" 에 이미 사용 중입니다.`,
  )
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} username
 * @param {string | null | undefined} excludeUserId
 */
async function assertUsernameAvailable(executor, username, excludeUserId = null) {
  const params = [username]
  let sql = `
    SELECT id FROM users
    WHERE is_deleted = false AND LOWER(TRIM(username)) = LOWER(TRIM($1))
  `
  if (excludeUserId) {
    sql += ` AND id <> $2`
    params.push(excludeUserId)
  }
  sql += ' LIMIT 1'
  const dup = await systemQuery(executor, sql, params)
  if (dup.rowCount > 0) {
    throw new Error(`[store-review] username "${username}" 는 이미 사용 중입니다.`)
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} tx
 * @param {{ userId: string; tenantId: number; industryId: number; scopeId: string }} params
 */
async function ensureUserMembership(tx, { userId, tenantId, industryId, scopeId }) {
  await systemQuery(
    tx,
    `
    INSERT INTO user_memberships (
      user_id, role, scope_type, scope_id, tenant_id, industry_id, status, membership_type, customer_access
    )
    SELECT
      $1::text,
      'user'::text,
      'tenant',
      $2::text,
      $3::bigint,
      $4::bigint,
      'active',
      'agent',
      'own'
    WHERE NOT EXISTS (
      SELECT 1
      FROM user_memberships m
      WHERE m.user_id = $1
        AND m.scope_type = 'tenant'
        AND m.tenant_id IS NOT DISTINCT FROM $3
        AND COALESCE(m.scope_id, '') IS NOT DISTINCT FROM $2
        AND LOWER(TRIM(COALESCE(m.role::text, ''))) = 'user'
    )
    `,
    [userId, scopeId, tenantId, industryId],
  )
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} tx
 * @param {{ userId: string; tenantId: number }} params
 */
async function ensureBillingAccess(tx, { userId, tenantId }) {
  const trialEndsAt = reviewTrialEndsIso()
  const existing = await systemQuery(
    tx,
    `SELECT id, status FROM billing_subscriptions WHERE user_id = $1 LIMIT 1`,
    [userId],
  )
  if (existing.rowCount > 0) {
    await systemQuery(
      tx,
      `
      UPDATE billing_subscriptions
      SET
        tenant_id = COALESCE(tenant_id, $2),
        plan_code = $3,
        status = 'trialing',
        billing_cycle = 'monthly',
        trial_started_at = COALESCE(trial_started_at, NOW()),
        trial_ends_at = $4::timestamptz,
        current_period_start = COALESCE(current_period_start, NOW()),
        current_period_end = $4::timestamptz,
        updated_at = NOW()
      WHERE user_id = $1
      `,
      [userId, tenantId, INSURANCE_BASIC_PLAN_CODE, trialEndsAt],
    )
    return
  }

  await systemQuery(
    tx,
    `
    INSERT INTO billing_subscriptions (
      user_id, tenant_id, plan_code, status, billing_cycle,
      trial_started_at, trial_ends_at, current_period_start, current_period_end,
      created_at, updated_at
    )
    VALUES ($1, $2, $3, 'trialing', 'monthly', NOW(), $4::timestamptz, NOW(), $4::timestamptz, NOW(), NOW())
    `,
    [userId, tenantId, INSURANCE_BASIC_PLAN_CODE, trialEndsAt],
  )
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ profile: string; password: string; execute: boolean }} params
 */
export async function provisionStoreReviewAccount(executor, params) {
  const profile = resolveStoreReviewProfile(params.profile)
  const execute = Boolean(params.execute)
  const password = String(params.password ?? '')
  if (execute && (password.length < 4 || password.length > 100)) {
    throw new Error(`[${profile.label}] password length must be 4..100`)
  }

  const phoneDigits = normalizeKrMobile(profile.phone)
  const phoneErr = validateKrMobileDigits(phoneDigits)
  if (phoneErr) {
    throw new Error(`[${profile.label}] invalid phone: ${phoneErr}`)
  }

  const gaTenant = await resolveReviewGaAndTenant(executor, { execute, label: profile.label })

  const existingR = await systemQuery(
    executor,
    `
    SELECT id, username, ga_id, phone_number, role, status, subscription_plan, subscription_expires_at
    FROM users
    WHERE LOWER(TRIM(username)) = LOWER(TRIM($1)) AND is_deleted = false
    LIMIT 1
    `,
    [profile.username],
  )
  const existing = existingR.rows[0] ?? null

  if (existing && Number(existing.ga_id) !== gaTenant.gaId && gaTenant.gaId != null) {
    throw new Error(
      `[${profile.label}] existing user ga_id=${existing.ga_id} != PLAY_REVIEW ga_id=${gaTenant.gaId}`,
    )
  }

  if (!execute) {
    return {
      mode: 'dry-run',
      profile: profile.key,
      username: profile.username,
      displayName: profile.displayName,
      phone: phoneDigits,
      ga: gaTenant,
      existingUserId: existing?.id ?? null,
      wouldCreateUser: !existing,
      wouldUpdateUser: Boolean(existing),
    }
  }

  if (gaTenant.gaId == null || gaTenant.tenantId == null) {
    throw new Error(`[${profile.label}] GA/tenant resolve failed`)
  }

  await assertPhoneAvailableForUserRole(executor, phoneDigits, existing?.id ?? null, {
    allowReviewSiblingRelease: profile.key === 'apple',
  })
  if (!existing) {
    await assertUsernameAvailable(executor, profile.username)
  }

  const passwordHash = execute ? await bcrypt.hash(password, 10) : ''
  const userId = existing?.id ?? randomUUID()
  const scopeId = String(gaTenant.tenantId)

  const client = executor.connect ? await executor.connect() : null
  const tx = client ?? executor

  try {
    if (client) {
      await tx.query('BEGIN')
    }

    if (existing) {
      await systemQuery(
        tx,
        `
        UPDATE users
        SET
          password_hash = $2,
          display_name = $3,
          phone_number = $4,
          ga_id = $5,
          role = 'USER',
          status = 'active',
          is_deleted = false,
          subscription_plan = 'FREE',
          subscription_expires_at = NULL,
          sms_auth_failure_count = 0,
          sms_blocked_until = NULL
        WHERE id = $1
        `,
        [userId, passwordHash, profile.displayName, phoneDigits, gaTenant.gaId],
      )
    } else {
      await systemQuery(
        tx,
        `
        INSERT INTO users (
          id, username, password_hash, role, display_name, phone_number,
          ga_id, status, is_deleted, subscription_plan, subscription_expires_at,
          invited_by_user_id, sms_auth_failure_count, sms_blocked_until
        )
        VALUES ($1, $2, $3, 'USER', $4, $5, $6, 'active', false, 'FREE', NULL, $1, 0, NULL)
        `,
        [
          userId,
          profile.username,
          passwordHash,
          profile.displayName,
          phoneDigits,
          gaTenant.gaId,
        ],
      )
    }

    await ensureUserMembership(tx, {
      userId,
      tenantId: gaTenant.tenantId,
      industryId: gaTenant.industryId,
      scopeId,
    })
    await ensureBillingAccess(tx, { userId, tenantId: gaTenant.tenantId })

    if (client) {
      await tx.query('COMMIT')
    }
  } catch (error) {
    if (client) {
      try {
        await tx.query('ROLLBACK')
      } catch {
        /* ignore */
      }
    }
    throw error
  } finally {
    client?.release?.()
  }

  return verifyStoreReviewAccount(executor, userId, profile)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @param {{ key: string; username: string; displayName: string; phone: string; label: string }} [profile]
 */
export async function verifyStoreReviewAccount(executor, userId, profile = null) {
  const userR = await systemQuery(
    executor,
    `
    SELECT
      u.id, u.username, u.display_name, u.phone_number, u.role, u.status,
      u.subscription_plan, u.subscription_expires_at, u.ga_id,
      g.code AS ga_code, g.name AS ga_name,
      u.sms_blocked_until, u.sms_auth_failure_count
    FROM users u
    INNER JOIN ga_companies g ON g.id = u.ga_id
    WHERE u.id = $1 AND u.is_deleted = false
    LIMIT 1
    `,
    [userId],
  )
  const user = userR.rows[0]
  if (!user) {
    throw new Error('[store-review] verify: user not found')
  }

  const custR = await systemQuery(
    executor,
    `SELECT COUNT(*)::int AS c FROM customers WHERE user_id = $1`,
    [userId],
  )
  const customerCount = Number(custR.rows[0]?.c ?? 0)

  const memR = await systemQuery(
    executor,
    `
    SELECT tenant_id, role, membership_type, customer_access, status
    FROM user_memberships
    WHERE user_id = $1
    ORDER BY id ASC
    `,
    [userId],
  )

  const billR = await systemQuery(
    executor,
    `
    SELECT status, plan_code, trial_ends_at, current_period_end
    FROM billing_subscriptions
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId],
  )

  const tenantR = await systemQuery(
    executor,
    `
    SELECT id, code, name, legacy_ga_id
    FROM tenants
    WHERE legacy_ga_id = $1 OR id IN (SELECT tenant_id FROM user_memberships WHERE user_id = $2)
    ORDER BY id ASC
    LIMIT 1
    `,
    [user.ga_id, userId],
  )

  return {
    profile: profile?.key ?? null,
    userId: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    phone: user.phone_number,
    gaId: user.ga_id,
    gaCode: user.ga_code,
    gaName: user.ga_name,
    tenant: tenantR.rows[0] ?? null,
    customerCount,
    subscriptionPlan: user.subscription_plan,
    subscriptionExpiresAt: user.subscription_expires_at,
    billing: billR.rows[0] ?? null,
    memberships: memR.rows,
    smsBlockedUntil: user.sms_blocked_until,
    smsAuthFailureCount: user.sms_auth_failure_count,
  }
}

/**
 * @param {{ baseUrl: string; username: string; password: string }} params
 */
export async function testStoreReviewLoginAndAccess(params) {
  const baseUrl = String(params.baseUrl ?? '').replace(/\/$/, '')
  const username = String(params.username ?? '').trim()
  const password = String(params.password ?? '')

  const loginRes = await fetch(`${baseUrl}/backend/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const loginJson = await loginRes.json().catch(() => ({}))
  const token = loginJson?.token
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  const checks = {}
  const paths = [
    ['/backend/api/customers?limit=1', 'customers'],
    ['/backend/api/insurer-news/feed', 'news'],
    ['/backend/api/storage/quota', 'storage'],
    ['/privacy', 'privacy'],
    ['/account-deletion', 'accountDeletion'],
  ]

  for (const [path, label] of paths) {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: label === 'privacy' || label === 'accountDeletion' ? {} : authHeaders,
    })
    checks[label] = { status: res.status, ok: res.ok }
  }

  return {
    loginOk: loginRes.ok,
    loginStatus: loginRes.status,
    role: loginJson?.user?.role ?? null,
    gaCode: loginJson?.user?.ga_code ?? loginJson?.user?.gaCode ?? null,
    tokenIssued: Boolean(token),
    checks,
  }
}
