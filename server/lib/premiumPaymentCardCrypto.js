import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const KEY_SALT = 'premium-payment-card-v1'

/**
 * @returns {Buffer | null}
 */
function deriveKey() {
  const raw = String(process.env.PREMIUM_PAYMENT_CARD_ENCRYPTION_KEY ?? '').trim()
  if (!raw) {
    return null
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex')
  }
  return scryptSync(raw, KEY_SALT, 32)
}

export function canEncryptPremiumPaymentCards() {
  return deriveKey() != null
}

export function getPremiumPaymentCardKeyVersion() {
  const v = String(process.env.PREMIUM_PAYMENT_CARD_ENCRYPTION_KEY_VERSION ?? '1').trim()
  return v || '1'
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeCardNumberDigits(raw) {
  return String(raw ?? '').replace(/\D/g, '')
}

/**
 * @param {string} digits
 * @returns {boolean}
 */
export function isValidCardNumberLuhn(digits) {
  const d = normalizeCardNumberDigits(digits)
  if (d.length < 13 || d.length > 19) {
    return false
  }
  let sum = 0
  let alt = false
  for (let i = d.length - 1; i >= 0; i -= 1) {
    let n = Number(d[i])
    if (!Number.isInteger(n)) {
      return false
    }
    if (alt) {
      n *= 2
      if (n > 9) {
        n -= 9
      }
    }
    sum += n
    alt = !alt
  }
  return sum % 10 === 0
}

/**
 * @param {string} digits
 * @returns {string | null}
 */
export function detectCardBrand(digits) {
  const d = normalizeCardNumberDigits(digits)
  if (!d) {
    return null
  }
  if (/^4/.test(d)) {
    return 'VISA'
  }
  if (/^5[1-5]/.test(d) || /^2(2[2-9]|[3-6]\d|7[01]|720)/.test(d)) {
    return 'MASTERCARD'
  }
  if (/^3[47]/.test(d)) {
    return 'AMEX'
  }
  if (/^6(?:011|5)/.test(d)) {
    return 'DISCOVER'
  }
  if (/^35/.test(d)) {
    return 'JCB'
  }
  if (/^62/.test(d)) {
    return 'UNIONPAY'
  }
  return 'OTHER'
}

/**
 * @param {string} digits
 * @returns {string}
 */
export function cardNumberLast4(digits) {
  const d = normalizeCardNumberDigits(digits)
  if (d.length < 4) {
    return d
  }
  return d.slice(-4)
}

/**
 * @param {string | null | undefined} last4OrDigits
 * @returns {string}
 */
export function maskCardNumberDisplay(last4OrDigits) {
  const last4 = cardNumberLast4(last4OrDigits)
  if (!last4) {
    return '•••• •••• •••• ••••'
  }
  return `•••• •••• •••• ${last4}`
}

/**
 * @param {string} plainDigitsOrFormatted
 * @returns {string} iv.tag.ciphertext (base64url)
 */
export function encryptPremiumPaymentCardNumber(plainDigitsOrFormatted) {
  const digits = normalizeCardNumberDigits(plainDigitsOrFormatted)
  if (!digits) {
    throw new Error('premium_payment_card_empty')
  }
  const key = deriveKey()
  if (!key) {
    throw new Error('premium_payment_card_encryption_unavailable')
  }
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(digits, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`
}

/**
 * @param {string | null | undefined} packed
 * @returns {string} digits only
 */
export function decryptPremiumPaymentCardNumber(packed) {
  const raw = String(packed ?? '').trim()
  if (!raw) {
    throw new Error('premium_payment_card_empty_ciphertext')
  }
  const key = deriveKey()
  if (!key) {
    throw new Error('premium_payment_card_encryption_unavailable')
  }
  const [ivB64, tagB64, dataB64] = raw.split('.')
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('premium_payment_card_invalid_ciphertext')
  }
  const iv = Buffer.from(ivB64, 'base64url')
  const tag = Buffer.from(tagB64, 'base64url')
  const data = Buffer.from(dataB64, 'base64url')
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
