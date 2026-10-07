import { sanitizeInsurancePathSegment } from './insuranceStorageLayout.js'

/**
 * 소식지 첨부 object key용 회사/게시판 슬러그 SSOT.
 * presign·proxy·저장 검증이 동일 세그먼트를 쓰도록 slugify 후 sanitize 한다.
 *
 * @param {unknown} displayName
 * @param {string} [fallback]
 */
export function newsPublisherStorageSlug(displayName, fallback = 'publisher') {
  const slugified = slugifyCompanySegment(displayName)
  const base = slugified && slugified !== 'insurer' ? slugified : fallback
  const sanitized = sanitizeInsurancePathSegment(base)
  return sanitized && sanitized !== '_' ? sanitized : sanitizeInsurancePathSegment(fallback)
}

/**
 * @param {unknown} name
 */
export function slugifyCompanySegment(name) {
  const t = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
  const stripped = t.replace(/[^\w\u3131-\u318e\uac00-\ud7a3-]/g, '')
  return stripped.slice(0, 48) || 'insurer'
}
