import { randomUUID } from 'node:crypto'
import { encryptPaymentSecret, decryptPaymentSecret } from '../billing/paymentSettingsCrypto.js'
import { systemQuery } from '../utils/dbSafeQuery.js'

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 */
export async function getBillingPaymentCredentialRow(executor, userId) {
  const r = await systemQuery(
    executor,
    `
    SELECT *
    FROM billing_payment_credentials
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId],
  )
  return r.rows[0] ?? null
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 */
export async function ensureBillingProviderCustomerKey(executor, userId) {
  const existing = await getBillingPaymentCredentialRow(executor, userId)
  if (existing?.provider_customer_key) {
    return String(existing.provider_customer_key)
  }

  const customerKey = `onefc_${randomUUID().replace(/-/g, '')}`
  await systemQuery(
    executor,
    `
    INSERT INTO billing_payment_credentials (
      user_id, provider, provider_customer_key, status, created_at, updated_at
    )
    VALUES ($1, 'toss', $2, 'pending', NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      provider_customer_key = COALESCE(billing_payment_credentials.provider_customer_key, EXCLUDED.provider_customer_key),
      updated_at = NOW()
    `,
    [userId, customerKey],
  )

  const row = await getBillingPaymentCredentialRow(executor, userId)
  return String(row?.provider_customer_key ?? customerKey)
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string; customerKey: string; billingKey: string; issuedMode?: string | null; cardCompany?: string | null; cardNumberMasked?: string | null; cardType?: string | null }} params
 */
export async function upsertBillingPaymentCredential(client, params) {
  const userId = String(params.userId ?? '').trim()
  const customerKey = String(params.customerKey ?? '').trim()
  const billingKey = String(params.billingKey ?? '').trim()
  if (!userId || !customerKey || !billingKey) {
    throw new Error('billing_credential_invalid')
  }

  const billingKeyCiphertext = encryptPaymentSecret(billingKey)
  const issuedMode = normalizeBillingIssuedMode(params.issuedMode)
  const cardCompany = params.cardCompany ? String(params.cardCompany).trim() : null
  const cardNumberMasked = params.cardNumberMasked ? String(params.cardNumberMasked).trim() : null
  const cardType = params.cardType ? String(params.cardType).trim() : null

  await systemQuery(
    client,
    `
    INSERT INTO billing_payment_credentials (
      user_id, provider, provider_customer_key, billing_key_ciphertext,
      card_company, card_number_masked, card_type, issued_mode,
      status, registered_at, created_at, updated_at
    )
    VALUES ($1, 'toss', $2, $3, $4, $5, $6, $7, 'active', NOW(), NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      provider = 'toss',
      provider_customer_key = EXCLUDED.provider_customer_key,
      billing_key_ciphertext = EXCLUDED.billing_key_ciphertext,
      card_company = EXCLUDED.card_company,
      card_number_masked = EXCLUDED.card_number_masked,
      card_type = EXCLUDED.card_type,
      issued_mode = EXCLUDED.issued_mode,
      status = 'active',
      registered_at = NOW(),
      updated_at = NOW()
    `,
    [userId, customerKey, billingKeyCiphertext, cardCompany, cardNumberMasked, cardType, issuedMode],
  )
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 */
export async function getActiveBillingKeyForUser(executor, userId) {
  const row = await getBillingPaymentCredentialRow(executor, userId)
  if (!row || String(row.status) !== 'active' || !row.billing_key_ciphertext) {
    return null
  }
  return {
    customerKey: String(row.provider_customer_key),
    billingKey: decryptPaymentSecret(String(row.billing_key_ciphertext)),
    cardCompany: row.card_company ? String(row.card_company) : null,
    cardNumberMasked: row.card_number_masked ? String(row.card_number_masked) : null,
    cardType: row.card_type ? String(row.card_type) : null,
    issuedMode: normalizeBillingIssuedMode(row.issued_mode),
  }
}

export function normalizeBillingIssuedMode(value) {
  return String(value ?? '').trim().toLowerCase() === 'live' ? 'live' : 'virtual'
}

/**
 * TEST(virtual) billingKey 를 LIVE charge 에 쓰지 못하게 한다.
 * @param {string | null | undefined} issuedMode
 * @param {string | null | undefined} currentMode
 */
export function assertBillingCredentialModeMatch(issuedMode, currentMode) {
  if (normalizeBillingIssuedMode(issuedMode) !== normalizeBillingIssuedMode(currentMode)) {
    throw new Error('billing_credential_environment_mismatch')
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @param {string} expectedCustomerKey
 */
export async function assertBillingCustomerKeyMatch(executor, userId, expectedCustomerKey) {
  const row = await getBillingPaymentCredentialRow(executor, userId)
  const stored = String(row?.provider_customer_key ?? '').trim()
  const expected = String(expectedCustomerKey ?? '').trim()
  if (!stored || !expected || stored !== expected) {
    throw new Error('billing_customer_key_mismatch')
  }
  return stored
}
