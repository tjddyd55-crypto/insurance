import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { getR2PublicCdnBase, isConsentR2Enabled, r2GetPresignedPutUrl } from '../lib/consentStorage.js'

export function advisorPublicCdnUrl(objectKey) {
  const key = String(objectKey ?? '').trim()
  if (!key) return null
  const base = getR2PublicCdnBase().replace(/\/$/, '')
  return `${base}/${key.replace(/^\//, '')}`
}

export const ADVISOR_PUBLIC_MEDIA_MAX_BYTES = 8 * 1024 * 1024
export const ADVISOR_PROFILE_MEDIA_MAX_BYTES = 5 * 1024 * 1024

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function isAdvisorImageContentType(contentType) {
  const ct = String(contentType ?? '').trim().toLowerCase()
  return ALLOWED_MIME.has(ct)
}

export function buildAdvisorPublicObjectKey(userId, kind, originalName) {
  const uid = String(userId ?? '').trim()
  if (!uid) throw new Error('invalid user')
  const ext = path.extname(String(originalName ?? '')).toLowerCase()
  const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.webp'
  const id = randomUUID()
  if (kind === 'profile') {
    return `advisor-public/${uid}/profile/photo-${id}${safeExt}`
  }
  return `advisor-public/${uid}/gallery/${id}${safeExt}`
}

export function assertAdvisorPublicObjectKeyOwned(userId, objectKey) {
  const uid = String(userId ?? '').trim()
  const key = String(objectKey ?? '').trim()
  if (!uid || !key) return false
  const prefix = `advisor-public/${uid}/`
  return key.startsWith(prefix) && !key.includes('..')
}

export async function createAdvisorPresignedUpload({ userId, kind, fileName, contentType, sizeBytes }) {
  if (!isConsentR2Enabled()) {
    return { ok: false, status: 503, message: '파일 저장소가 준비되지 않았습니다.' }
  }
  const ct = String(contentType ?? '').trim().toLowerCase()
  if (!isAdvisorImageContentType(ct)) {
    return { ok: false, status: 400, message: 'JPG, PNG, WebP 이미지만 업로드할 수 있습니다.' }
  }
  const size = Number(sizeBytes)
  const max = kind === 'profile' ? ADVISOR_PROFILE_MEDIA_MAX_BYTES : ADVISOR_PUBLIC_MEDIA_MAX_BYTES
  if (!Number.isFinite(size) || size < 1 || size > max) {
    return { ok: false, status: 400, message: `파일 크기는 ${Math.floor(max / (1024 * 1024))}MB 이하여야 합니다.` }
  }
  const objectKey = buildAdvisorPublicObjectKey(userId, kind, fileName)
  const uploadUrl = await r2GetPresignedPutUrl(objectKey, ct, 900, {
    cacheControl: 'public, max-age=31536000, immutable',
  })
  if (!uploadUrl) {
    return { ok: false, status: 500, message: '업로드 URL을 만들지 못했습니다.' }
  }
  return { ok: true, objectKey, uploadUrl, contentType: ct }
}
