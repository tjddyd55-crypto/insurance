import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
import { failure } from './config.js'
export const tokenHash = (token) => createHash('sha256').update(String(token)).digest('hex')
export const newToken = () => randomBytes(32).toString('base64url')
function key(secret) {
  const bytes = /^[a-f\d]{64}$/i.test(secret || '') ? Buffer.from(secret, 'hex') : Buffer.from(secret || '', 'base64')
  if (bytes.length !== 32) throw failure(503, 'healthway_dedicated_key_required')
  return bytes
}
export function encrypt(value, secret, context) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv)
  cipher.setAAD(Buffer.from(context))
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((x) => x.toString('base64url')).join('.')
}
export function decrypt(value, secret, context) {
  try {
    const [iv, tag, data] = value.split('.').map((x) => Buffer.from(x, 'base64url'))
    const cipher = createDecipheriv('aes-256-gcm', key(secret), iv)
    cipher.setAAD(Buffer.from(context)); cipher.setAuthTag(tag)
    return JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8'))
  } catch { throw failure(503, 'healthway_decryption_failed') }
}
