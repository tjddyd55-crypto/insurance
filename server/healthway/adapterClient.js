import { createHmac, randomBytes } from 'node:crypto'
import { tokenHash } from './crypto.js'
import { failure } from './config.js'
export function signAdapterRequest(secret, path, body, { timestamp = String(Math.floor(Date.now() / 1000)), nonce = randomBytes(24).toString('base64url') } = {}) {
  const message = ['POST', path, timestamp, nonce, tokenHash(body)].join('\n')
  return { 'Content-Type': 'application/json', 'X-Healthway-Timestamp': timestamp, 'X-Healthway-Nonce': nonce,
    'X-Healthway-Signature': createHmac('sha256', secret).update(message).digest('hex') }
}
export function createAdapterClient(config, fetcher = fetch) {
  const call = async (path, input) => {
    const body = JSON.stringify(input)
    try {
      const response = await fetcher(new URL(path, config.adapterUrl), { method: 'POST', body,
        headers: signAdapterRequest(config.sharedSecret, path, body), signal: AbortSignal.timeout(30_000), redirect: 'error' })
      if (!response.ok) throw failure(503, 'adapter_unavailable')
      const data = await response.json()
      if (config.provider === 'offline' && data.mock !== true) throw failure(503, 'offline_provider_mismatch')
      return data
    } catch { throw failure(503, 'adapter_unavailable') } // Never propagate SDK payload/PII/token-bearing errors.
  }
  return { sdk: (id, args = [], token) => call(`/sdk/${id}`, { args, ...(token ? { token } : {}) }),
    certification: (input) => call('/sdk/0221', input), signature: (consent) => call('/signature', consent) }
}
