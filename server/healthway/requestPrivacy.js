// Match both application mounts (including legacy aliases), without retaining query data in logs.
export function isHealthwayCallbackPath(url = '') {
  return /^\/(?:(?:api|backend)\/(?:api\/)?)?healthway\/callback(?:\/|$)/i.test(String(url).split('?')[0])
}
export function safeRequestLogPath(req) {
  const url = String(req?.originalUrl ?? req?.url ?? req?.path ?? '')
  return isHealthwayCallbackPath(url) ? url.split('?')[0] : url
}
// The callback has no body/CORS contract. Let its all-method handler reject even malformed POSTs
// and OPTIONS; generic JSON parsing and automatic CORS preflight must not intercept it.
export const bypassHealthwayCallback = (middleware) => (req, res, next) =>
  isHealthwayCallbackPath(req.originalUrl ?? req.url) ? next() : middleware(req, res, next)
