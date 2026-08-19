import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12

function deriveKey() {
  const raw = String(process.env.PAYMENT_SETTINGS_SECRET_KEY ?? '').trim()
  if (!raw) {
    return null
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex')
  }
  return scryptSync(raw, 'payment-settings-v1', 32)
}

export function canStorePaymentSecrets() {
  return deriveKey() != null
}

export function getPaymentSettingsEncryptionDiagnostics() {
  return { configured: canStorePaymentSecrets() }
}

/**
 * @param {string} plain
 * @returns {string}
 */
export function encryptPaymentSecret(plain) {
  const key = deriveKey()
  if (!key) {
    throw new Error('payment_secret_storage_unavailable')
  }
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`
}

/**
 * @param {string} packed
 * @returns {string}
 */
export function decryptPaymentSecret(packed) {
  const key = deriveKey()
  if (!key) {
    throw new Error('payment_secret_storage_unavailable')
  }
  const [ivB64, tagB64, dataB64] = String(packed ?? '').split('.')
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('payment_secret_invalid_ciphertext')
  }
  const iv = Buffer.from(ivB64, 'base64url')
  const tag = Buffer.from(tagB64, 'base64url')
  const data = Buffer.from(dataB64, 'base64url')
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

/**
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function maskPaymentCredential(value) {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return null
  }
  if (raw.length <= 4) {
    return '****'
  }
  return `${'*'.repeat(Math.min(raw.length - 4, 12))}${raw.slice(-4)}`
}
