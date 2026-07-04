/**
 * share-visibility API 요청/응답 정규화.
 * 표준 필드는 `enabled`(boolean). `isEnabled` 는 임시 호환만 허용한다.
 */

/**
 * @param {unknown} body
 * @returns {boolean | null} null 이면 validation 실패
 */
export function parseShareVisibilityEnabledFromBody(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return null
  }
  const record = /** @type {Record<string, unknown>} */ (body)
  if (typeof record.enabled === 'boolean') {
    return record.enabled
  }
  if (typeof record.isEnabled === 'boolean') {
    return record.isEnabled
  }
  return null
}

/**
 * @param {boolean} enabled
 */
export function shareVisibilitySuccessPayload(enabled) {
  return {
    success: true,
    data: {
      enabled: Boolean(enabled),
    },
  }
}

/**
 * PATCH share-visibility 400 직전 진단 로그(민감정보 제외).
 * @param {import('express').Request} req
 * @param {string} reason
 * @param {{ userId?: string, gaId?: number | null }} meta
 */
export function logShareVisibilityPatchValidationFailure(req, reason, meta = {}) {
  const body =
    req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? /** @type {Record<string, unknown>} */ (req.body)
      : null
  const bodyKeys = body ? Object.keys(body) : []
  console.warn('[share-visibility] PATCH validation failed', {
    reason,
    bodyKeys,
    enabledType: body && 'enabled' in body ? typeof body.enabled : 'missing',
    isEnabledType: body && 'isEnabled' in body ? typeof body.isEnabled : 'missing',
    userId: meta.userId ?? null,
    gaId: meta.gaId ?? null,
  })
}
