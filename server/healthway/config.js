export function healthwayConfig(env = process.env) {
  const enabled = env.HEALTHWAY_MODULE_ENABLED === 'true'
  const provider = env.HEALTHWAY_PROVIDER || 'offline'
  const production = ['production', 'prod'].includes(String(env.NODE_ENV || '').toLowerCase()) ||
    ['production', 'prod'].includes(String(env.APP_ENV || env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_ENVIRONMENT || '').toLowerCase())
  const offline = provider === 'offline' && !production
  const asOf = env.HEALTHWAY_OFFLINE_AS_OF_DATE
  return { enabled, provider, offline, production, asOf,
    adapterUrl: env.HEALTHWAY_ADAPTER_URL,
    sharedSecret: env.HEALTHWAY_ADAPTER_SHARED_SECRET,
    tokenKey: env.HEALTHWAY_TOKEN_SECRET_KEY,
    decryptionKey: env.HEALTHWAY_DECRYPTION_KEY,
  }
}
export function assertConfigured(config) {
  if (!config.enabled) throw failure(404, 'module_disabled')
  if (!config.offline) throw failure(503, 'provider_not_configured')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.asOf || '') || !Number.isFinite(Date.parse(config.asOf)) || new Date(config.asOf).toISOString().slice(0, 10) !== config.asOf) throw failure(503, 'offline_reference_date_required')
  if (!config.adapterUrl || !config.sharedSecret || config.sharedSecret.length < 32 || !config.tokenKey) throw failure(503, 'healthway_configuration_required')
  const key = /^[a-f\d]{64}$/i.test(config.tokenKey) ? Buffer.from(config.tokenKey, 'hex') : Buffer.from(config.tokenKey, 'base64')
  if (key.length !== 32) throw failure(503, 'healthway_dedicated_key_required')
  let url
  try { url = new URL(config.adapterUrl) } catch { throw failure(503, 'invalid_adapter_url') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw failure(503, 'invalid_adapter_url')
}
export function failure(status, code) { return Object.assign(new Error(code), { status, code }) }
