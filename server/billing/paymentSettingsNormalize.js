/**
 * payment_settings mode/provider 정규화 (서버 SSOT).
 */

/**
 * @param {unknown} value
 * @returns {'virtual' | 'live'}
 */
export function normalizePaymentMode(value) {
  const mode = String(value ?? '').trim().toLowerCase()
  return mode === 'live' ? 'live' : 'virtual'
}

/**
 * @param {unknown} value
 * @returns {'toss' | 'none'}
 */
export function normalizePaymentProvider(value) {
  const provider = String(value ?? '').trim().toLowerCase()
  return provider === 'none' ? 'none' : 'toss'
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function mapPaymentSettingsAdminRow(row) {
  const src = row ?? {}
  const clientKey = String(src.client_key ?? '').trim()
  const secretKey = String(src.secret_key_ciphertext ?? '').trim()
  const webhookSecret = String(src.webhook_secret_ciphertext ?? '').trim()
  return {
    provider: normalizePaymentProvider(src.provider),
    mode: normalizePaymentMode(src.mode),
    clientKey,
    secretKeyCiphertext: secretKey,
    webhookSecretCiphertext: webhookSecret,
    isEnabled: src.is_enabled === true,
    updatedAt: src.updated_at ?? null,
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function mapPaymentSettingsPublicRow(row) {
  const src = row ?? {}
  return {
    provider: normalizePaymentProvider(src.provider),
    mode: normalizePaymentMode(src.mode),
    isEnabled: src.is_enabled === true,
    updatedAt: src.updated_at ?? null,
  }
}
