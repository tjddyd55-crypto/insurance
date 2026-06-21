/**
 * Express 라우터 mount(`/backend`, `/api` 등)에 따라 `req.path`만으로는
 * `/api/...` SSOT allowlist 와 어긋날 수 있다. 정책 미들웨어는 항상 이 함수로 경로를 통일한다.
 *
 * @param {{ baseUrl?: string; path?: string }} req
 * @returns {string}
 */
export function resolveApiPolicyPath(req) {
  const base = String(req?.baseUrl ?? '').replace(/\/$/, '')
  const path = String(req?.path ?? '')
  let combined = `${base}${path}`
  if (!combined.startsWith('/')) {
    combined = `/${combined}`
  }

  if (combined.startsWith('/backend/api/')) {
    return `/api/${combined.slice('/backend/api/'.length)}`
  }
  if (combined.startsWith('/backend/')) {
    return `/api/${combined.slice('/backend/'.length)}`
  }
  if (combined.startsWith('/api/api/')) {
    return `/api/${combined.slice('/api/api/'.length)}`
  }

  if (!combined.startsWith('/api/') && path.startsWith('/')) {
    return `/api${path}`
  }

  return combined
}
