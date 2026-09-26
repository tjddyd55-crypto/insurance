import jwt from 'jsonwebtoken'

import { BINDER_PAGE_IMAGE_WIDTH_BUCKETS } from './binderPageImageWidth.js'

export const BINDER_PAGE_IMAGE_TOKEN_TTL_SEC = 10 * 60
const TOKEN_SCOPE = 'personal-binder-page-image'

function positiveInt(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

/**
 * React Native Image 는 Authorization 헤더를 붙이지 못하므로
 * 자료·페이지·너비가 박힌 10분 JWT 로 이미지를 연다.
 */
export function issueBinderPageImageToken(secret, claims) {
  return jwt.sign(
    {
      scope: TOKEN_SCOPE,
      uid: claims.userId,
      ga: claims.gaId,
      mid: claims.materialId,
      fid: claims.fileId,
      page: claims.page,
      width: claims.width,
    },
    secret,
    { expiresIn: BINDER_PAGE_IMAGE_TOKEN_TTL_SEC },
  )
}

function claimsFromPayload(payload) {
  const userId = String(payload?.uid ?? '').trim()
  const gaId = positiveInt(payload?.ga)
  const materialId = positiveInt(payload?.mid)
  const fileId = positiveInt(payload?.fid)
  const page = positiveInt(payload?.page)
  const width = positiveInt(payload?.width)
  if (!userId || payload?.scope !== TOKEN_SCOPE) return null
  if (gaId == null || materialId == null || fileId == null || page == null || width == null) return null
  if (!BINDER_PAGE_IMAGE_WIDTH_BUCKETS.includes(width)) return null
  return { userId, gaId, materialId, fileId, page, width }
}

export function readBinderPageImageToken(secret, token) {
  try {
    const payload = jwt.verify(String(token ?? ''), secret)
    const claims = claimsFromPayload(payload)
    if (!claims) return { ok: false, status: 410 }
    return { ok: true, claims }
  } catch {
    return { ok: false, status: 410 }
  }
}
