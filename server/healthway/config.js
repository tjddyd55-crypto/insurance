export function healthwayConfig(env = process.env) {
  const enabled = env.HEALTHWAY_MODULE_ENABLED === 'true'
  const provider = env.HEALTHWAY_PROVIDER || 'offline'
  const production = env.NODE_ENV === 'production' || env.RAILWAY_ENVIRONMENT_NAME === 'production'
  const offline = provider === 'offline' && !production
  const asOf = env.HEALTHWAY_OFFLINE_AS_OF_DATE
  return { enabled, provider, offline, production, asOf,
    adapterUrl: env.HEALTHWAY_ADAPTER_URL,
    sharedSecret: env.HEALTHWAY_ADAPTER_SHARED_SECRET,
    tokenKey: env.HEALTHWAY_TOKEN_SECRET_KEY,
  }
}
export function assertConfigured(config) {
  if (!config.enabled) throw failure(404, 'module_disabled')
  if (!config.offline) throw failure(503, 'provider_not_configured')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.asOf || '') || new Date(config.asOf).toISOString().slice(0, 10) !== config.asOf) throw failure(503, 'offline_reference_date_required')
  if (!config.adapterUrl || !config.sharedSecret || config.sharedSecret.length < 32 || !config.tokenKey) throw failure(503, 'healthway_configuration_required')
}
export function failure(status, code) { return Object.assign(new Error(code), { status, code }) }
