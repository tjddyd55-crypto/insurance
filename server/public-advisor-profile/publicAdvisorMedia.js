import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { INSURANCE_STORAGE_PREFIX } from '../storage/insuranceStorageKeys.js'
import {
  buildR2PresignedPutHeaders,
  getR2PublicCdnBase,
  isConsentR2Enabled,
  r2GetPresignedPutUrl,
} from '../lib/consentStorage.js'

/** R2 object key — CDN은 `insurance/*` 경로만 공개 서빙한다. */
export const ADVISOR_PUBLIC_RELATIVE_PREFIX = 'advisor-public'
export const ADVISOR_PUBLIC_OBJECT_PREFIX = `${INSURANCE_STORAGE_PREFIX}/${ADVISOR_PUBLIC_RELATIVE_PREFIX}`

const LEGACY_OBJECT_PREFIX = `${ADVISOR_PUBLIC_RELATIVE_PREFIX}/`

/**
 * DB에 저장된 키를 CDN URL용으로 정규화한다.
 * (레거시 `advisor-public/…` 키는 R2에 그 경로로만 존재하므로 신규 업로드·재업로드가 필요하다.)
 * @param {string | null | undefined} objectKey
 */
export function normalizeAdvisorPublicObjectKeyForCdn(objectKey) {
  const raw = String(objectKey ?? '').trim().replace(/^\//, '')
  if (!raw) return ''
  if (raw.startsWith(`${INSURANCE_STORAGE_PREFIX}/`)) {
    return raw
  }
  if (raw.startsWith(LEGACY_OBJECT_PREFIX)) {
    return `${INSURANCE_STORAGE_PREFIX}/${raw}`
  }
  return raw
}

export function advisorPublicCdnUrl(objectKey) {
  const key = normalizeAdvisorPublicObjectKeyForCdn(objectKey)
  if (!key) return null
  const base = getR2PublicCdnBase().replace(/\/$/, '')
  return `${base}/${key}`
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
    return `${ADVISOR_PUBLIC_OBJECT_PREFIX}/${uid}/profile/photo-${id}${safeExt}`
  }
  if (kind === 'business-card-front') {
    return `${ADVISOR_PUBLIC_OBJECT_PREFIX}/${uid}/business-card/front-${id}${safeExt}`
  }
  if (kind === 'business-card-back' || kind === 'business_card_back') {
    throw new Error('명함은 앞면만 업로드할 수 있습니다.')
  }
  return `${ADVISOR_PUBLIC_OBJECT_PREFIX}/${uid}/gallery/${id}${safeExt}`
}

export function isBlockedAdvisorBusinessCardBackKind(raw) {
  const kind = String(raw ?? '').trim().toLowerCase()
  return kind === 'business-card-back' || kind === 'business_card_back'
}

export function normalizeAdvisorPublicMediaKind(raw) {
  if (isBlockedAdvisorBusinessCardBackKind(raw)) return null
  const kind = String(raw ?? '').trim().toLowerCase()
  if (kind === 'gallery') return 'gallery'
  if (kind === 'profile') return 'profile'
  if (kind === 'business-card-front' || kind === 'business_card_front') return 'business-card-front'
  return 'profile'
}

function ownedKeyPrefixesForUser(uid) {
  return [
    `${ADVISOR_PUBLIC_OBJECT_PREFIX}/${uid}/`,
    `${ADVISOR_PUBLIC_RELATIVE_PREFIX}/${uid}/`,
  ]
}

export function assertAdvisorPublicObjectKeyOwned(userId, objectKey) {
  const uid = String(userId ?? '').trim()
  const key = String(objectKey ?? '').trim()
  if (!uid || !key) return false
  if (key.includes('..')) return false
  return ownedKeyPrefixesForUser(uid).some((prefix) => key.startsWith(prefix))
}

export async function createAdvisorPresignedUpload({ userId, kind, fileName, contentType, sizeBytes }) {
  if (kind == null || isBlockedAdvisorBusinessCardBackKind(kind)) {
    return { ok: false, status: 400, message: '명함은 앞면만 업로드할 수 있습니다.' }
  }
  if (!isConsentR2Enabled()) {
    return { ok: false, status: 503, message: '파일 저장소가 준비되지 않았습니다.' }
  }
  const ct = String(contentType ?? '').trim().toLowerCase()
  if (!isAdvisorImageContentType(ct)) {
    return { ok: false, status: 400, message: 'JPG, PNG, WebP 이미지만 업로드할 수 있습니다.' }
  }
  const size = Number(sizeBytes)
  const max =
    kind === 'profile' ? ADVISOR_PROFILE_MEDIA_MAX_BYTES : ADVISOR_PUBLIC_MEDIA_MAX_BYTES
  if (!Number.isFinite(size) || size < 1 || size > max) {
    return { ok: false, status: 400, message: `파일 크기는 ${Math.floor(max / (1024 * 1024))}MB 이하여야 합니다.` }
  }
  const objectKey = buildAdvisorPublicObjectKey(userId, kind, fileName)
  const cacheControl = 'public, max-age=31536000, immutable'
  const uploadUrl = await r2GetPresignedPutUrl(objectKey, ct, 900, { cacheControl })
  if (!uploadUrl) {
    return { ok: false, status: 500, message: '업로드 URL을 만들지 못했습니다.' }
  }
  const putHeaders = buildR2PresignedPutHeaders(cacheControl)
  return { ok: true, objectKey, uploadUrl, contentType: ct, putHeaders, cacheControl }
}
