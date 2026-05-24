import { systemQuery } from '../utils/dbSafeQuery.js'
import {
  canStorePaymentSecrets,
  encryptPaymentSecret,
  maskPaymentCredential,
} from './paymentSettingsCrypto.js'

const DEFAULT_ROW_ID = 1

/**
 * @returns {Promise<object>}
 */
export async function ensurePaymentSettingsRow(executor) {
  await systemQuery(
    executor,
    `
    INSERT INTO payment_settings (id)
    VALUES ($1)
    ON CONFLICT (id) DO NOTHING
    `,
    [DEFAULT_ROW_ID],
  )
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function getPaymentSettingsPublic(executor) {
  await ensurePaymentSettingsRow(executor)
  const r = await systemQuery(
    executor,
    `
    SELECT provider, mode, is_enabled, updated_at
    FROM payment_settings
    WHERE id = $1
    LIMIT 1
    `,
    [DEFAULT_ROW_ID],
  )
  const row = r.rows[0] ?? {}
  return {
    provider: String(row.provider ?? 'toss'),
    mode: String(row.mode ?? 'virtual'),
    isEnabled: row.is_enabled === true,
    updatedAt: row.updated_at ?? null,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function getPaymentSettingsAdmin(executor) {
  await ensurePaymentSettingsRow(executor)
  const r = await systemQuery(
    executor,
    `
    SELECT provider, mode, client_key, secret_key_ciphertext, webhook_secret_ciphertext,
           is_enabled, updated_at
    FROM payment_settings
    WHERE id = $1
    LIMIT 1
    `,
    [DEFAULT_ROW_ID],
  )
  const row = r.rows[0] ?? {}
  return {
    provider: String(row.provider ?? 'toss'),
    mode: String(row.mode ?? 'virtual'),
    clientKeyMasked: maskPaymentCredential(row.client_key),
    hasSecretKey: Boolean(String(row.secret_key_ciphertext ?? '').trim()),
    hasWebhookSecret: Boolean(String(row.webhook_secret_ciphertext ?? '').trim()),
    isEnabled: row.is_enabled === true,
    canStoreSecrets: canStorePaymentSecrets(),
    updatedAt: row.updated_at ?? null,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {Record<string, unknown>} body
 * @param {string | null} actorUserId
 */
export async function updatePaymentSettings(executor, body, actorUserId) {
  await ensurePaymentSettingsRow(executor)
  const sets = []
  const vals = []
  let n = 1

  if (Object.prototype.hasOwnProperty.call(body, 'mode')) {
    const mode = String(body.mode ?? '').trim().toLowerCase()
    if (mode !== 'virtual' && mode !== 'live') {
      throw new Error('invalid_payment_mode')
    }
    sets.push(`mode = $${n++}`)
    vals.push(mode)
  }

  if (Object.prototype.hasOwnProperty.call(body, 'provider')) {
    const provider = String(body.provider ?? '').trim().toLowerCase()
    if (provider !== 'toss' && provider !== 'none') {
      throw new Error('invalid_payment_provider')
    }
    sets.push(`provider = $${n++}`)
    vals.push(provider)
  }

  if (Object.prototype.hasOwnProperty.call(body, 'is_enabled') || Object.prototype.hasOwnProperty.call(body, 'isEnabled')) {
    const enabled = body.is_enabled ?? body.isEnabled
    sets.push(`is_enabled = $${n++}`)
    vals.push(enabled === true)
  }

  if (Object.prototype.hasOwnProperty.call(body, 'client_key') || Object.prototype.hasOwnProperty.call(body, 'clientKey')) {
    const clientKey = String(body.client_key ?? body.clientKey ?? '').trim()
    sets.push(`client_key = $${n++}`)
    vals.push(clientKey || null)
  }

  const secretRaw = body.secret_key ?? body.secretKey
  if (secretRaw != null && String(secretRaw).trim() !== '') {
    if (!canStorePaymentSecrets()) {
      throw new Error('payment_secret_storage_unavailable')
    }
    sets.push(`secret_key_ciphertext = $${n++}`)
    vals.push(encryptPaymentSecret(String(secretRaw).trim()))
  }

  const webhookRaw = body.webhook_secret ?? body.webhookSecret
  if (webhookRaw != null && String(webhookRaw).trim() !== '') {
    if (!canStorePaymentSecrets()) {
      throw new Error('payment_secret_storage_unavailable')
    }
    sets.push(`webhook_secret_ciphertext = $${n++}`)
    vals.push(encryptPaymentSecret(String(webhookRaw).trim()))
  }

  if (sets.length === 0) {
    return getPaymentSettingsAdmin(executor)
  }

  sets.push(`updated_at = NOW()`)
  sets.push(`updated_by_user_id = $${n++}`)
  vals.push(actorUserId ?? null)
  vals.push(DEFAULT_ROW_ID)

  await systemQuery(
    executor,
    `
    UPDATE payment_settings
    SET ${sets.join(', ')}
    WHERE id = $${n}
    `,
    vals,
  )

  return getPaymentSettingsAdmin(executor)
}
