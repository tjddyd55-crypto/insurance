import { systemQuery } from '../utils/dbSafeQuery.js'
import { decryptPaymentSecret } from './paymentSettingsCrypto.js'
import { mapPaymentSettingsAdminRow } from './paymentSettingsNormalize.js'
import { ensurePaymentSettingsRow } from './paymentSettings.js'

const DEFAULT_ROW_ID = 1

/**
 * 서버 내부 전용 — secret 복호화 포함. API 응답에 사용 금지.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function resolvePaymentSettingsInternal(executor) {
  await ensurePaymentSettingsRow(executor)
  const r = await systemQuery(
    executor,
    `
    SELECT provider, mode, client_key, secret_key_ciphertext, webhook_secret_ciphertext, is_enabled, updated_at
    FROM payment_settings
    WHERE id = $1
    LIMIT 1
    `,
    [DEFAULT_ROW_ID],
  )
  const mapped = mapPaymentSettingsAdminRow(r.rows[0])
  let secretKey = ''
  if (mapped.secretKeyCiphertext) {
    secretKey = decryptPaymentSecret(mapped.secretKeyCiphertext)
  }
  let webhookSecret = ''
  if (mapped.webhookSecretCiphertext) {
    webhookSecret = decryptPaymentSecret(mapped.webhookSecretCiphertext)
  }
  return {
    provider: mapped.provider,
    mode: mapped.mode,
    clientKey: mapped.clientKey,
    secretKey,
    webhookSecret,
    isEnabled: mapped.isEnabled,
    updatedAt: mapped.updatedAt,
    hasSecretKey: secretKey.length > 0,
    hasClientKey: mapped.clientKey.length > 0,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function getPaymentSettingsPublicWithClientKey(executor) {
  await ensurePaymentSettingsRow(executor)
  const r = await systemQuery(
    executor,
    `
    SELECT provider, mode, client_key, is_enabled, updated_at
    FROM payment_settings
    WHERE id = $1
    LIMIT 1
    `,
    [DEFAULT_ROW_ID],
  )
  const row = r.rows[0] ?? {}
  const mapped = mapPaymentSettingsAdminRow(row)
  return {
    provider: mapped.provider,
    mode: mapped.mode,
    clientKey: mapped.clientKey || null,
    isEnabled: mapped.isEnabled,
    updatedAt: mapped.updatedAt,
  }
}
