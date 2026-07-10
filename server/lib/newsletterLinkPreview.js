/**
 * 소식지 payload 내 링크 미리보기 정규화.
 * 기존 글(필드 없음)과 호환 — null 허용.
 */

import { resolveAdminNoticeLinkPreview } from '../admin-notices/adminNoticeLinkPreview.js'

/**
 * DB row.payload — jsonb 객체 또는 JSON 문자열을 안전하게 파싱한다.
 * @param {unknown} raw
 * @returns {Record<string, unknown>}
 */
export function parseNewsletterPayload(raw) {
  if (raw == null) {
    return {}
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return /** @type {Record<string, unknown>} */ (raw)
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) {
      return {}
    }
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return /** @type {Record<string, unknown>} */ (parsed)
      }
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * payload(또는 row.payload)에서 linkPreview를 추출·정규화한다.
 * @param {unknown} payloadInput
 * @returns {ReturnType<typeof normalizeNewsletterLinkPreview>}
 */
export function extractNewsletterLinkPreviewFromPayload(payloadInput) {
  const payload =
    payloadInput != null &&
    typeof payloadInput === 'object' &&
    !Array.isArray(payloadInput)
      ? /** @type {Record<string, unknown>} */ (payloadInput)
      : parseNewsletterPayload(payloadInput)
  return normalizeNewsletterLinkPreview(payload.linkPreview ?? payload.link_preview)
}

/**
 * @param {unknown} raw
 * @returns {{
 *   url: string,
 *   title: string | null,
 *   description: string | null,
 *   imageUrl: string | null,
 *   siteName: string | null,
 *   domain: string | null,
 * } | null}
 */
export function normalizeNewsletterLinkPreview(raw) {
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
 * 요청 body / draft 에서 linkPreview 추출.
 * 명시적으로 null 이면 제거, undefined 이면 기존 유지용으로 null 반환하지 않음 — 호출측에서 처리.
 * @param {unknown} body
 * @returns {{ linkPreview: ReturnType<typeof normalizeNewsletterLinkPreview> | null, provided: boolean }}
 */
export function extractLinkPreviewFromBody(body) {
  if (body == null || typeof body !== 'object') {
    return { linkPreview: null, provided: false }
  }
  const row = /** @type {Record<string, unknown>} */ (body)
  if (!Object.prototype.hasOwnProperty.call(row, 'linkPreview') && !Object.prototype.hasOwnProperty.call(row, 'link_preview')) {
    return { linkPreview: null, provided: false }
  }
  const raw = row.linkPreview ?? row.link_preview
  if (raw == null) {
    return { linkPreview: null, provided: true }
  }
  return { linkPreview: normalizeNewsletterLinkPreview(raw), provided: true }
}

/**
 * 상세 API 응답용 — top-level linkPreview와 payload.linkPreview를 함께 정규화한다.
 * @param {unknown} rowOrDetail
 * @returns {ReturnType<typeof normalizeNewsletterLinkPreview>}
 */
export function resolveNewsletterDetailLinkPreview(rowOrDetail) {
  if (rowOrDetail == null || typeof rowOrDetail !== 'object') {
    return null
  }
  const row = /** @type {Record<string, unknown>} */ (rowOrDetail)
  const fromTop = normalizeNewsletterLinkPreview(row.linkPreview ?? row.link_preview)
  if (fromTop?.url) {
    return fromTop
  }
  const payload = parseNewsletterPayload(row.payload)
  return extractNewsletterLinkPreviewFromPayload(payload)
}

/**
 * 링크 미리보기 API 공통 응답 — insurer-news / board-writer endpoint가 동일 포맷을 반환한다.
 * @param {unknown} urlInput
 * @returns {Promise<{ success: true, preview: ReturnType<typeof normalizeNewsletterLinkPreview> }>}
 */
export async function fetchNewsletterLinkPreviewForApi(urlInput) {
  const url = String(urlInput ?? '').trim()
  if (!url) {
    return { success: true, preview: null }
  }
  const data = await resolveAdminNoticeLinkPreview(url)
  if (!data) {
    return { success: true, preview: null }
  }
  return {
    success: true,
    preview: normalizeNewsletterLinkPreview({
      url: data.url,
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl ?? data.image,
      siteName: data.siteName,
      domain: data.domain,
    }),
  }
}
