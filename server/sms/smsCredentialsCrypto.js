import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { isSmsModuleProductionRuntime } from './smsModuleConfig.js'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12

function deriveKey() {
  const smsKey = String(process.env.SMS_CREDENTIALS_SECRET_KEY ?? '').trim()
  if (smsKey) {
    if (/^[0-9a-fA-F]{64}$/.test(smsKey)) {
      return Buffer.from(smsKey, 'hex')
    }
    return scryptSync(smsKey, 'sms-credentials-v1', 32)
  }
  if (isSmsModuleProductionRuntime()) {
    return null
  }
  const fallback = String(process.env.PAYMENT_SETTINGS_SECRET_KEY ?? '').trim()
  if (!fallback) {
    return null
  }
  if (/^[0-9a-fA-F]{64}$/.test(fallback)) {
    return Buffer.from(fallback, 'hex')
  }
  return scryptSync(fallback, 'payment-settings-v1', 32)
}

export function canStoreSmsCredentials() {
  if (isSmsModuleProductionRuntime()) {
    return String(process.env.SMS_CREDENTIALS_SECRET_KEY ?? '').trim().length > 0
  }
  return deriveKey() != null
}

function credentialStorageError() {
  if (isSmsModuleProductionRuntime()) {
    const err = new Error('sms_credential_secret_required')
    err.status = 503
    err.publicMessage =
      '운영 환경에서는 SMS_CREDENTIALS_SECRET_KEY 설정이 필요합니다. 관리자에게 문의해 주세요.'
    throw err
  }
  const err = new Error('sms_credential_storage_unavailable')
  err.status = 503
  err.publicMessage = 'API Key 저장 기능이 구성되지 않았습니다. 관리자에게 문의해 주세요.'
  throw err
}

/**
 * @param {string} plain
 * @returns {string}
 */
export function encryptSmsCredential(plain) {
  const key = deriveKey()
  if (!key) {
    credentialStorageError()
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
export function decryptSmsCredential(packed) {
  const key = deriveKey()
  if (!key) {
    credentialStorageError()
  }
  const [ivB64, tagB64, dataB64] = String(packed ?? '').split('.')
  if (!ivB64 || !tagB64 || !dataB64) {
    const err = new Error('sms_credential_invalid_ciphertext')
    err.status = 500
    err.publicMessage = '저장된 API Key를 불러올 수 없습니다. 다시 저장해 주세요.'
    throw err
  }
  try {
    const iv = Buffer.from(ivB64, 'base64url')
    const tag = Buffer.from(tagB64, 'base64url')
    const data = Buffer.from(dataB64, 'base64url')
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  } catch {
    const err = new Error('sms_credential_decrypt_failed')
    err.status = 500
    err.publicMessage = '저장된 API Key를 불러올 수 없습니다. 다시 저장해 주세요.'
    throw err
  }
}

/**
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function maskSmsCredential(value) {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return null
  }
  if (raw.length <= 4) {
    return '****'
  }
  return `${'*'.repeat(Math.min(raw.length - 4, 12))}${raw.slice(-4)}`
}

/**
 * provider raw response 에서 민감 필드 제거
 * @param {unknown} raw
 */
export function sanitizeProviderRaw(raw) {
  if (raw == null || typeof raw !== 'object') {
    return raw
  }
  const clone = { .../** @type {Record<string, unknown>} */ (raw) }
  for (const key of ['key', 'api_key', 'apiKey', 'user_id', 'userid', 'sender', 'receiver']) {
    if (key in clone) {
      clone[key] = maskSmsCredential(String(clone[key] ?? ''))
    }
  }
  return clone
}
