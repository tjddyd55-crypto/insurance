/**
 * GA 그룹 공개 URL 슬러그 정규화·검증.
 */

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeGaGroupSlug(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true; slug: string } | { ok: false; message: string }}
 */
export function validateGaGroupSlug(raw) {
  const slug = normalizeGaGroupSlug(raw)
  if (slug.length < 2) {
    return { ok: false, message: 'URL 슬러그는 2자 이상이어야 합니다.' }
  }
  if (slug.length > 48) {
    return { ok: false, message: 'URL 슬러그는 48자 이하여야 합니다.' }
  }
  if (!SLUG_RE.test(slug)) {
    return {
      ok: false,
      message: 'URL 슬러그는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.',
    }
  }
  return { ok: true, slug }
}
