import { systemQuery } from '../utils/dbSafeQuery.js'
import {
  canStorePaymentSecrets,
  encryptPaymentSecret,
  maskPaymentCredential,
} from './paymentSettingsCrypto.js'
import {
  mapPaymentSettingsAdminRow,
  mapPaymentSettingsPublicRow,
  normalizePaymentMode,
  normalizePaymentProvider,
} from './paymentSettingsNormalize.js'

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
  const row = r.rows[0]
  const mapped = mapPaymentSettingsPublicRow(row)
  return {
    provider: mapped.provider,
    mode: mapped.mode,
    isEnabled: mapped.isEnabled,
    updatedAt: mapped.updatedAt,
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
  const row = r.rows[0]
  const mapped = mapPaymentSettingsAdminRow(row)
  return {
    provider: mapped.provider,
    mode: mapped.mode,
    clientKeyMasked: maskPaymentCredential(mapped.clientKey || null),
    hasClientKey: mapped.clientKey.length > 0,
    hasSecretKey: mapped.secretKeyCiphertext.length > 0,
    hasWebhookSecret: mapped.webhookSecretCiphertext.length > 0,
    isEnabled: mapped.isEnabled,
    canStoreSecrets: canStorePaymentSecrets(),
    updatedAt: mapped.updatedAt,
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
    const mode = normalizePaymentMode(body.mode)
    sets.push(`mode = $${n++}`)
    vals.push(mode)
  }

  if (Object.prototype.hasOwnProperty.call(body, 'provider')) {
    const provider = normalizePaymentProvider(body.provider)
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
