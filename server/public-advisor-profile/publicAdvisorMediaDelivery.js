import { consentGetBuffer } from '../lib/consentStorage.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { normalizeAdvisorPublicObjectKeyForCdn } from './publicAdvisorMedia.js'

/**
 * @param {string | null | undefined} objectKey
 */
export function advisorPublicMediaPath(objectKey) {
  const key = normalizeAdvisorPublicObjectKeyForCdn(objectKey)
  if (!key) return null
  return `/api/public/advisor-media?key=${encodeURIComponent(key)}`
}

/**
 * @param {string | null | undefined} objectKey
 * @param {string | null | undefined} origin
 */
export function advisorPublicMediaUrl(objectKey, origin) {
  const path = advisorPublicMediaPath(objectKey)
  if (!path) return null
  const base = String(origin ?? '').trim().replace(/\/$/, '')
  return base ? `${base}${path}` : path
}

/**
 * 공개 프로필·갤러리에 연결된 이미지만 스트리밍한다.
 * @param {import('pg').Pool} pool
 * @param {string} objectKey
 */
export async function assertAdvisorPublicMediaIsPublished(pool, objectKey) {
  const key = normalizeAdvisorPublicObjectKeyForCdn(objectKey)
  if (!key) return false

  const profile = await systemQuery(
    pool,
    `
    SELECT 1
    FROM advisor_public_profiles p
    INNER JOIN users u ON u.id = p.user_id
    WHERE p.is_published = true
      AND p.is_deleted = false
      AND u.is_deleted = false
      AND u.role = 'USER'
      AND u.status = 'active'
      AND (
        p.profile_photo_object_key = $1
        OR p.profile_photo_object_key = $2
      )
    LIMIT 1
    `,
    [key, objectKey],
  )
  if (profile.rowCount > 0) return true

  const gallery = await systemQuery(
    pool,
    `
    SELECT 1
    FROM advisor_public_profile_gallery g
    INNER JOIN advisor_public_profiles p ON p.user_id = g.user_id
    INNER JOIN users u ON u.id = p.user_id
    WHERE g.object_key = $1
      AND p.is_published = true
      AND p.is_deleted = false
      AND u.is_deleted = false
      AND u.role = 'USER'
      AND u.status = 'active'
    LIMIT 1
    `,
    [key],
  )
  return gallery.rowCount > 0
}

/**
 * @param {string} objectKey
 */
export async function readAdvisorPublicMediaBuffer(objectKey) {
  const key = normalizeAdvisorPublicObjectKeyForCdn(objectKey)
  const legacy = String(objectKey ?? '').trim().replace(/^\//, '')
  try {
    return await consentGetBuffer(key)
  } catch (e) {
    if (legacy && legacy !== key) {
      return await consentGetBuffer(legacy)
    }
    throw e
  }
}

export function guessAdvisorPublicMediaContentType(objectKey) {
  const lower = String(objectKey ?? '').toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}
