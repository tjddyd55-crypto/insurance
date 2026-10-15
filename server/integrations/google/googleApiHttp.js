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

const WRITE_TIMEOUT_MS = 15 * 1000

/**
 * Google REST 쓰기(POST·PATCH·PUT·DELETE). 응답 본문·토큰은 오류에 담지 않는다.
 * 시간 초과는 google_timeout(결과 불명확)으로 따로 던져 호출자가 중복 여부를 확인하게 한다.
 * @param {typeof fetch} fetchImpl
 * @param {'POST' | 'PATCH' | 'PUT' | 'DELETE'} method
 * @param {URL} url
 * @param {string} accessToken
 * @param {{ body?: unknown, ifMatch?: string }} [options]
 * @returns {Promise<any>} 204 이면 null
 */
export async function googleSendJson(fetchImpl, method, url, accessToken, options = {}) {
  const headers = { Authorization: `Bearer ${accessToken}` }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.ifMatch) headers['If-Match'] = options.ifMatch
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), WRITE_TIMEOUT_MS) : null
  let response
  try {
    response = await fetchImpl(url, {
      method,
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(controller ? { signal: controller.signal } : {}),
    })
  } catch (error) {
    throw googleError(error?.name === 'AbortError' ? 'google_timeout' : 'google_unavailable')
  } finally {
    if (timer) clearTimeout(timer)
  }
  if (response.status === 401) throw googleError('google_unauthorized')
  if (response.status === 404 || response.status === 410) throw googleError('google_not_found')
  if (response.status === 409) throw googleError('google_conflict')
  if (response.status === 412) throw googleError('google_precondition_failed')
  if (response.status === 429) throw googleError('google_rate_limited')
  if (response.status === 400) throw googleError('google_bad_request')
  if (response.status === 403) {
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
    if (/accessNotConfigured|SERVICE_DISABLED/i.test(reason)) throw googleError('google_api_disabled')
    if (/insufficientPermissions|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(reason)) throw googleError('write_scope_missing')
    throw googleError('google_forbidden')
  }
  if (!response.ok) throw googleError(response.status >= 500 ? 'google_unavailable' : 'google_bad_request')
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
