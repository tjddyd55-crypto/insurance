import { createHmac, timingSafeEqual } from 'node:crypto'
import { deriveHealthwayKey } from './crypto.js'
import { failure } from './config.js'

const label = 'healthway:mock-callback:v1'
const cases = new Set(['CASE1', 'CASE2', 'CASE3', 'CASE4'])
function validPayload(payload, now) {
  return payload && typeof payload === 'object' && !Array.isArray(payload) &&
    Object.keys(payload).length === 3 && Object.keys(payload).every((k) => ['demandDealingsNo', 'exp', 'case'].includes(k)) &&
    typeof payload.demandDealingsNo === 'string' && payload.demandDealingsNo.length > 0 &&
    Number.isSafeInteger(payload.exp) && payload.exp > now && payload.exp <= now + 600 && cases.has(payload.case)
}
const signature = (message, secret) => createHmac('sha256', deriveHealthwayKey(secret, label)).update(message).digest()

export function signMockCallback(payload, secret, now = Math.floor(Date.now() / 1000)) {
  if (!validPayload(payload, now)) throw failure(400, 'invalid_mock_payload')
  const message = `MOCKCB.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`
  return `${message}.${signature(message, secret).toString('hex')}`
}

export function verifyMockCallback(resultData, config, now = Math.floor(Date.now() / 1000)) {
  if (!config.offline) throw failure(400, 'verify_failed')
  try {
    const parts = resultData.split('.')
    if (parts.length !== 3 || parts[0] !== 'MOCKCB' || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || !/^[a-f\d]{64}$/.test(parts[2])) throw new Error()
    const message = parts.slice(0, 2).join('.')
    if (!timingSafeEqual(signature(message, config.tokenKey), Buffer.from(parts[2], 'hex'))) throw new Error()
    const bytes = Buffer.from(parts[1], 'base64url')
    if (bytes.toString('base64url') !== parts[1]) throw new Error()
    const payload = JSON.parse(bytes.toString('utf8'))
    if (!validPayload(payload, now)) throw new Error()
    return { demandDealingsNo: payload.demandDealingsNo, caseCode: payload.case }
  } catch { throw failure(400, 'verify_failed') }
}
