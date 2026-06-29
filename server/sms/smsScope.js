import { parseGaId } from '../lib/parseGaId.js'
import { resolveTenantIdForUser } from '../insurance-billing/subscriptionLifecycle.js'
import { systemQuery } from '../utils/dbSafeQuery.js'

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string; customerId: number }} params
 */
export async function assertCustomerOwnedByScope(executor, params) {
  const customerId = Number(params.customerId)
  if (!(Number.isInteger(customerId) && customerId > 0)) {
    const err = new Error('sms_customer_invalid')
    err.status = 400
    throw err
  }
  const r = await systemQuery(
    executor,
    `
    SELECT c.id
    FROM customers c
    INNER JOIN users u ON u.id = c.user_id
    INNER JOIN tenants t ON t.legacy_ga_id = u.ga_id
    WHERE c.id = $1
      AND c.user_id = $2
      AND t.id = $3
    LIMIT 1
    `,
    [customerId, params.userId, params.tenantId],
  )
  if (r.rowCount === 0) {
    const err = new Error('sms_customer_not_owned')
    err.status = 403
    err.publicMessage = '선택한 고객에 대한 문자 발송 권한이 없습니다.'
    throw err
  }
  return r.rows[0]
}

/**
 * @param {import('express').Request} req
 * @returns {{ userId: string; tenantId: number; gaId: number | null }}
 */
export async function resolveSmsAuthContext(executor, req) {
  const userId = String(req.user?.id ?? '').trim()
  if (!userId) {
    const err = new Error('sms_auth_required')
    err.status = 401
    throw err
  }
  const gaId = parseGaId(req.user?.gaId)
  const jwtTenant = Number(req.user?.customerTenantDbId ?? 0)
  let tenantId =
    Number.isSafeInteger(jwtTenant) && jwtTenant > 0 ? jwtTenant : await resolveTenantIdForUser(executor, userId, gaId)
  if (!(Number.isSafeInteger(tenantId) && tenantId > 0)) {
    const err = new Error('sms_tenant_not_found')
    err.status = 404
    throw err
  }
  return { userId, tenantId, gaId }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 */
export async function loadActiveSmsProviderAccount(executor, scope) {
  const r = await systemQuery(
    executor,
    `
    SELECT id, tenant_id, user_id, provider, provider_user_id, api_key_encrypted,
           default_sender, is_active, last_balance_checked_at, created_at, updated_at
    FROM sms_provider_accounts
    WHERE tenant_id = $1 AND user_id = $2 AND provider = 'aligo' AND is_active = true
    LIMIT 1
    `,
    [scope.tenantId, scope.userId],
  )
  return r.rows[0] ?? null
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string; senderNumber: string; requireVerified?: boolean }} params
 */
export async function assertOwnedSenderNumber(executor, params) {
  const sender = String(params.senderNumber ?? '').replace(/\D/g, '')
  const r = await systemQuery(
    executor,
    `
    SELECT id, sender_number, status, label, is_default, provider_account_id
    FROM sms_sender_numbers
    WHERE tenant_id = $1 AND user_id = $2 AND sender_number = $3
    LIMIT 1
    `,
    [params.tenantId, params.userId, sender],
  )
  const row = r.rows[0]
  if (!row) {
    const err = new Error('sms_sender_not_registered')
    err.status = 400
    err.publicMessage = '등록되지 않은 발신번호입니다. 문자 설정에서 발신번호를 등록해 주세요.'
    throw err
  }
  if (params.requireVerified !== false && String(row.status) !== 'verified') {
    const err = new Error('sms_sender_not_verified')
    err.status = 400
    err.publicMessage = '테스트 발송으로 검증된 발신번호만 사용할 수 있습니다.'
    throw err
  }
  return row
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; phones: string[] }} params
 * @returns {Promise<Set<string>>}
 */
export async function loadOptOutPhoneSet(executor, params) {
  if (!params.phones.length) {
    return new Set()
  }
  const r = await systemQuery(
    executor,
    `
    SELECT phone FROM sms_opt_outs
    WHERE tenant_id = $1 AND phone = ANY($2::text[])
    `,
    [params.tenantId, params.phones],
  )
  return new Set(r.rows.map((row) => String(row.phone)))
}
