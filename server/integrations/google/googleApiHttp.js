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
  if (response.status === 403) {
    throw googleError('google_forbidden')
  }
  if (!response.ok) {
    throw googleError('google_unavailable')
  }
  return response.json()
}
