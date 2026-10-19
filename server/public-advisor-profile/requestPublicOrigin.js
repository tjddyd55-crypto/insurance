/**
 * Railway 등 reverse proxy 앞에서 req.protocol이 http로 잡히는 경우 https 공유 URL을 복원한다.
 * @param {import('express').Request} req
 */
export function resolveRequestPublicOrigin(req) {
  const forwarded = String(req.headers['x-forwarded-proto'] ?? '')
    .split(',')[0]
    .trim()
    .toLowerCase()
  const protocol =
    forwarded === 'https' || forwarded === 'http' ? forwarded : String(req.protocol ?? 'https')
  const host = String(req.get?.('host') ?? req.headers?.host ?? '').trim()
  if (!host) return ''
  return `${protocol}://${host}`
}
