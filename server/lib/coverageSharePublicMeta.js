import { escapeHtmlAttr } from './customerInviteRegistrationPublic.js'

export const COVERAGE_SHARE_PAGE_DESCRIPTION = '기존 보장과 제안 보장을 비교해 보세요.'

/**
 * @param {string | null | undefined} customerName
 */
export function buildCoverageSharePageTitle(customerName) {
  const name = String(customerName ?? '').trim()
  if (!name) return '보장 시뮬레이션'
  return `${name}님 보장 시뮬레이션`
}

/**
 * @param {import('express').Request} req
 */
export function buildCoverageShareOgImageUrl(req) {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https').split(',')[0].trim()
  const host = String(req.headers['x-forwarded-host'] ?? req.get('host') ?? '').split(',')[0].trim()
  if (!host) return '/icon.png'
  return `${proto}://${host}/icon.png`
}

/**
 * @param {string} html
 * @param {{ customerName?: string | null }} payload
 * @param {import('express').Request} req
 */
export function injectCoverageSharePublicMeta(html, payload, req) {
  const title = buildCoverageSharePageTitle(payload.customerName)
  const desc = COVERAGE_SHARE_PAGE_DESCRIPTION
  const image = buildCoverageShareOgImageUrl(req)
  const t = escapeHtmlAttr(title)
  const d = escapeHtmlAttr(desc)
  const img = escapeHtmlAttr(image)

  const metaBlock = `
    <meta name="robots" content="noindex, nofollow" />
    <meta name="description" content="${d}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${img}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />
`

  let out = String(html)
    .replace(/<title>[^<]*<\/title>/i, `<title>${t}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']robots["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:title["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:description["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:type["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:image["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:card["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:title["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:description["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:image["'][^>]*>/gi, '')

  out = out.replace(/<head>/i, `<head>${metaBlock}`)
  return out
}
