/**
 * 상세 뷰어용 링크 미리보기 추출 — top-level linkPreview와 payload.linkPreview 모두 지원.
 */

/**
 * @param {unknown} raw
 * @returns {import('../types').NewsletterLinkPreview | null}
 */
function normalizeLinkPreview(raw) {
  if (raw == null || typeof raw !== 'object') {
    return null
  }
  const row = /** @type {Record<string, unknown>} */ (raw)
  const url = String(row.url ?? row.link_url ?? '').trim()
  if (!url) {
    return null
  }
  let domain = String(row.domain ?? '').trim()
  if (!domain) {
    try {
      domain = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      domain = ''
    }
  }
  return {
    url,
    title: String(row.title ?? row.link_title ?? '').trim() || null,
    description: String(row.description ?? row.link_description ?? '').trim() || null,
    imageUrl: String(row.imageUrl ?? row.image_url ?? row.image ?? '').trim() || null,
    siteName: String(row.siteName ?? row.site_name ?? row.link_site_name ?? '').trim() || null,
    domain: domain || null,
  }
}

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
function parsePayload(raw) {
  if (raw == null) {
    return null
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return /** @type {Record<string, unknown>} */ (raw)
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) {
      return null
    }
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return /** @type {Record<string, unknown>} */ (parsed)
      }
    } catch {
      return null
    }
  }
  return null
}

/**
 * @param {import('../types').NewsletterDetail | import('../types').NewsletterItem | Record<string, unknown> | null | undefined} detail
 * @returns {import('../types').NewsletterLinkPreview | null}
 */
export function getNewsletterLinkPreview(detail) {
  if (!detail) {
    return null
  }

  const fromTop = normalizeLinkPreview(detail.linkPreview ?? detail.link_preview)
  if (fromTop?.url) {
    return fromTop
  }

  const payload = parsePayload(detail.payload)
  if (payload) {
    const fromPayload = normalizeLinkPreview(payload.linkPreview ?? payload.link_preview)
    if (fromPayload?.url) {
      return fromPayload
    }
  }

  const raw = /** @type {{ raw?: { payload?: unknown } }} */ (detail).raw
  const nestedPayload = parsePayload(raw?.payload)
  if (nestedPayload) {
    return normalizeLinkPreview(nestedPayload.linkPreview ?? nestedPayload.link_preview)
  }

  return null
}
