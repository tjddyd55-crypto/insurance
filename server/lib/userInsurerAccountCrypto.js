import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12

function deriveKey() {
  const raw = String(
    process.env.USER_INSURER_ACCOUNT_SECRET_KEY ?? process.env.PAYMENT_SETTINGS_SECRET_KEY ?? '',
  ).trim()
  if (!raw) {
    return null
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex')
  }
  return scryptSync(raw, 'user-insurer-account-v1', 32)
}

export function canStoreUserInsurerAccountSecrets() {
  return deriveKey() != null
}

/**
 * @param {string} plain
 * @returns {string}
 */
export function encryptUserInsurerAccountPassword(plain) {
  const key = deriveKey()
  if (!key) {
    throw new Error('user_insurer_account_secret_storage_unavailable')
  }
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`
}

/**
 * @param {string | null | undefined} packed
 * @returns {string}
 */
export function decryptUserInsurerAccountPassword(packed) {
  const raw = String(packed ?? '').trim()
  if (!raw) {
    return ''
  }
  const key = deriveKey()
  if (!key) {
    return ''
  }
  const [ivB64, tagB64, dataB64] = raw.split('.')
  if (!ivB64 || !tagB64 || !dataB64) {
    return ''
  }
  const iv = Buffer.from(ivB64, 'base64url')
  const tag = Buffer.from(tagB64, 'base64url')
  const data = Buffer.from(dataB64, 'base64url')
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
