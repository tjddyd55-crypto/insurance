import { googleError } from './googleTokenService.js'

/**
 * Google REST GET. 응답 본문·토큰은 오류에 담지 않고 code 만 던진다.
 * @param {typeof fetch} fetchImpl
 * @param {URL} url
 * @param {string} accessToken
 */
export async function googleGetJson(fetchImpl, url, accessToken) {
  let response
  try {
    response = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  } catch {
    throw googleError('google_unavailable')
  }
  if (response.status === 401) {
    throw googleError('google_unauthorized')
  }
  if (response.status === 429) {
    throw googleError('google_rate_limited')
  }
  if (response.status === 403) {
    // 할당량·속도 제한도 403 으로 온다. 이 경우 재연결을 권하지 않는다(사유 문자열만 보고 본문은 버린다).
    let reason = ''
    try {
      const body = await response.json()
      reason = String(body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? '')
    } catch {
      reason = ''
    }
    if (/rateLimitExceeded|userRateLimitExceeded|quotaExceeded|dailyLimitExceeded|RESOURCE_EXHAUSTED/i.test(reason)) {
      throw googleError('google_rate_limited')
    }
    if (/accessNotConfigured|SERVICE_DISABLED/i.test(reason)) {
      // Cloud 프로젝트에서 Calendar/Tasks API 가 꺼져 있음 — 사용자 재연결로는 해결되지 않는다.
      throw googleError('google_api_disabled')
    }
    throw googleError('google_forbidden')
  }
  if (!response.ok) {
    throw googleError('google_unavailable')
  }
  return response.json()
}
