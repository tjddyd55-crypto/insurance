import { geocodeWithKakao, getKakaoGeocodingCredentials } from './customerGeocodingKakao.js'
import { geocodeWithNaver, getNaverGeocodingCredentials } from './customerGeocodingNaver.js'

/** @typedef {'naver' | 'kakao'} GeocodingProviderName */

/**
 * @returns {GeocodingProviderName}
 */
export function resolvePreferredGeocodingProvider() {
  const raw = String(
    process.env.MAP_GEOCODING_PROVIDER ?? process.env.VITE_MAP_PROVIDER ?? 'naver',
  )
    .trim()
    .toLowerCase()
  return raw === 'kakao' ? 'kakao' : 'naver'
}

/**
 * @returns {{ preferred: GeocodingProviderName; naver: boolean; kakao: boolean }}
 */
export function getGeocodingProviderStatus() {
  const preferred = resolvePreferredGeocodingProvider()
  return {
    preferred,
    naver: getNaverGeocodingCredentials().configured,
    kakao: getKakaoGeocodingCredentials().configured,
  }
}

/**
 * @param {GeocodingProviderName} name
 * @param {string} query
 * @param {{ fetchImpl?: typeof fetch }} [options]
 */
async function geocodeWithProvider(name, query, options) {
  if (name === 'kakao') {
    const result = await geocodeWithKakao(query, options)
    return result.ok
      ? { ok: true, latitude: result.latitude, longitude: result.longitude, provider: 'kakao' }
      : { ok: false, error: result.error, provider: 'kakao' }
  }
  const result = await geocodeWithNaver(query, options)
  return result.ok
    ? { ok: true, latitude: result.latitude, longitude: result.longitude, provider: 'naver' }
    : { ok: false, error: result.error, provider: 'naver' }
}

/**
 * 네이버 우선, 실패·미설정 시 카카오 fallback.
 *
 * @param {string} query
 * @param {{ fetchImpl?: typeof fetch; preferred?: GeocodingProviderName }} [options]
 */
export async function geocodeCustomerAddress(query, options = {}) {
  const preferred = options.preferred ?? resolvePreferredGeocodingProvider()
  const fallback = preferred === 'naver' ? 'kakao' : 'naver'
  const order = /** @type {GeocodingProviderName[]} */ ([preferred, fallback])

  /** @type {string[]} */
  const errors = []

  for (const name of order) {
    const creds = name === 'naver' ? getNaverGeocodingCredentials() : getKakaoGeocodingCredentials()
    if (!creds.configured) {
      errors.push(`${name}:not_configured`)
      continue
    }
    const result = await geocodeWithProvider(name, query, options)
    if (result.ok) {
      return result
    }
    errors.push(`${name}:${result.error}`)
  }

  return {
    ok: false,
    error: errors.length > 0 ? errors.join(';') : 'no_provider_configured',
    provider: null,
  }
}
