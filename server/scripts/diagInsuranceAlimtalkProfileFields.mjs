/**
 * Safe probe: profile/list field shapes + senderKey fingerprint match.
 * No secret values printed.
 */
import { createHash } from 'node:crypto'
import { loadInsuranceAlimtalkConfig } from '../alimtalk/alimtalkConfig.js'

function fp(value) {
  const s = String(value ?? '')
  if (!s) return null
  return createHash('sha256').update(s).digest('hex').slice(0, 8)
}

const c = loadInsuranceAlimtalkConfig()
const url = `${c.gatewayUrl.replace(/\/+$/, '')}/profile-list`
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${c.gatewayToken}`,
  },
  body: JSON.stringify({ apikey: c.apiKey, userid: c.userId }),
})
const text = await res.text()
let data = {}
try {
  data = text ? JSON.parse(text) : {}
} catch {
  data = { parseError: true, text: String(text).slice(0, 200) }
}
const list = Array.isArray(data.list) ? data.list : []
const confFp = fp(c.senderKey)
const rows = list.map((item, i) => {
  const keys = item && typeof item === 'object' ? Object.keys(item) : []
  const sk = item?.senderkey ?? item?.senderKey ?? item?.sender_key ?? null
  return {
    i,
    keys,
    name: item?.name ?? item?.channel ?? item?.phn_name ?? null,
    status: item?.status ?? null,
    category: item?.category ?? null,
    skPresent: Boolean(sk),
    skLen: sk ? String(sk).length : 0,
    skFp: fp(sk),
    matchesConfig: sk ? fp(sk) === confFp : false,
  }
})
console.log(
  JSON.stringify(
    {
      httpStatus: res.status,
      code: data.code ?? data.providerCode,
      message: data.message ?? data.providerMessage,
      listCount: list.length,
      configSenderKeyFp: confFp,
      configSenderKeyLen: c.senderKey.length,
      anyMatch: rows.some((r) => r.matchesConfig),
      rows,
    },
    null,
    2,
  ),
)
