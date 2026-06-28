import * as cheerio from 'cheerio'

const MAX_BYTES = 1024 * 1024
const MAX_REDIRECTS = 3
const FETCH_TIMEOUT_MS = 3000

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '0.0.0.0',
  'metadata.google.internal',
  'metadata',
  'instance-data',
])

/**
 * @param {string} hostname
 */
function isBlockedHostname(hostname) {
  const lower = String(hostname ?? '').trim().toLowerCase()
  if (!lower) {
    return true
  }
  if (BLOCKED_HOSTNAMES.has(lower)) {
    return true
  }
  if (lower.endsWith('.local') || lower.endsWith('.internal')) {
    return true
  }
  return false
}

/**
 * @param {string} ip
 */
function isPrivateOrReservedIp(ip) {
  const parts = ip.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }
  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  return false
}

/**
 * @param {string} rawUrl
 */
export function assertSafeExternalUrl(rawUrl) {
  let url
  try {
    url = new URL(String(rawUrl ?? '').trim())
  } catch {
    throw new Error('invalid_url')
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('invalid_url')
  }
  if (isBlockedHostname(url.hostname)) {
    throw new Error('blocked_url')
  }
  if (isPrivateOrReservedIp(url.hostname)) {
    throw new Error('blocked_url')
  }
  if (url.username || url.password) {
    throw new Error('blocked_url')
  }
  return url.toString()
}

/**
 * @param {string} startUrl
 */
async function fetchHtmlWithLimits(startUrl) {
  let currentUrl = assertSafeExternalUrl(startUrl)

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'InsuranceLinkPreview/1.0',
        },
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) {
          return null
        }
        currentUrl = assertSafeExternalUrl(new URL(location, currentUrl).toString())
        continue
      }

      if (!response.ok || !response.body) {
        return null
      }

      const reader = response.body.getReader()
      const chunks = []
      let received = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        received += value.byteLength
        if (received > MAX_BYTES) {
          break
        }
        chunks.push(value)
      }
      return Buffer.concat(chunks).toString('utf8')
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  return null
}

/**
 * @param {string} html
 * @param {string} pageUrl
 */
export function parseLinkPreviewFromHtml(html, pageUrl) {
  const $ = cheerio.load(html)
  const canonical =
    $('link[rel="canonical"]').attr('href') ||
    $('meta[property="og:url"]').attr('content') ||
    pageUrl
  let resolvedUrl = pageUrl
  try {
    resolvedUrl = assertSafeExternalUrl(new URL(String(canonical).trim(), pageUrl).toString())
  } catch {
    resolvedUrl = pageUrl
  }

  const title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('title').first().text().trim() ||
    ''
  const description =
    $('meta[property="og:description"]').attr('content')?.trim() ||
    $('meta[name="description"]').attr('content')?.trim() ||
    ''
  const imageRaw = $('meta[property="og:image"]').attr('content')?.trim() || ''
  let image = ''
  if (imageRaw) {
    try {
      image = assertSafeExternalUrl(new URL(imageRaw, resolvedUrl).toString())
    } catch {
      image = ''
    }
  }
  const siteName = $('meta[property="og:site_name"]').attr('content')?.trim() || ''
  let domain = ''
  try {
    domain = new URL(resolvedUrl).hostname.replace(/^www\./, '')
  } catch {
    domain = ''
  }

  if (!title && !description && !image) {
    return null
  }

  return {
    url: resolvedUrl,
    title,
    description,
    image,
    siteName,
    domain,
  }
}

/**
 * @param {string} rawUrl
 */
export async function resolveAdminNoticeLinkPreview(rawUrl) {
  try {
    const safeUrl = assertSafeExternalUrl(rawUrl)
    const html = await fetchHtmlWithLimits(safeUrl)
    if (!html) {
      return null
    }
    return parseLinkPreviewFromHtml(html, safeUrl)
  } catch {
    return null
  }
}
