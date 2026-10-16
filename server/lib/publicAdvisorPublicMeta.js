import { escapeHtmlAttr } from './customerInviteRegistrationPublic.js'

/**
 * @param {import('express').Request} req
 * @param {string} pathSuffix
 */
export function buildAbsolutePublicUrl(req, pathSuffix) {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https').split(',')[0].trim()
  const host = String(req.headers['x-forwarded-host'] ?? req.get('host') ?? '').split(',')[0].trim()
  const path = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`
  return host ? `${proto}://${host}${path}` : path
}

/**
 * @param {import('express').Request} req
 */
export function defaultAdvisorOgImageUrl(req) {
  return buildAbsolutePublicUrl(req, '/icon.png')
}

/**
 * @param {string} html
 * @param {{
 *   title: string
 *   description: string
 *   imageUrl: string
 *   canonicalUrl: string
 *   indexable: boolean
 * }} meta
 */
export function injectPublicAdvisorProfileMeta(html, meta) {
  const robots = meta.indexable ? 'index, follow' : 'noindex, nofollow'
  const t = escapeHtmlAttr(meta.title)
  const d = escapeHtmlAttr(meta.description)
  const img = escapeHtmlAttr(meta.imageUrl)
  const url = escapeHtmlAttr(meta.canonicalUrl)

  const metaBlock = `
    <meta name="robots" content="${robots}" />
    <meta name="description" content="${d}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:type" content="profile" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${img}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />
`

  let out = String(html)
    .replace(/<title>[^<]*<\/title>/i, `<title>${t}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']robots["'][^>]*>/gi, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:title["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:description["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:type["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:url["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:image["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:card["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:title["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:description["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:image["'][^>]*>/gi, '')

  out = out.replace(/<head>/i, `<head>${metaBlock}`)
  return out
}
