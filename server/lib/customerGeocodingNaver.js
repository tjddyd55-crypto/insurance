const GEOCODE_URL = 'https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode'

/**
 * @returns {{ configured: boolean; clientId: string; clientSecret: string }}
 */
export function getNaverGeocodingCredentials() {
  const clientId = String(process.env.NAVER_GEOCODING_CLIENT_ID ?? '').trim()
  const clientSecret = String(process.env.NAVER_GEOCODING_CLIENT_SECRET ?? '').trim()
  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
  }
}

/**
 * @param {string} query
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ ok: true; latitude: number; longitude: number } | { ok: false; error: string }>}
 */
export async function geocodeWithNaver(query, options = {}) {
  const { configured, clientId, clientSecret } = getNaverGeocodingCredentials()
  if (!configured) {
    return { ok: false, error: 'naver_geocoding_not_configured' }
  }

  const q = String(query ?? '').trim()
  if (!q) {
    return { ok: false, error: 'empty_query' }
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const url = `${GEOCODE_URL}?query=${encodeURIComponent(q)}`
  let res
  try {
    res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
        Accept: 'application/json',
      },
    })
  } catch (err) {
    return { ok: false, error: `network_error:${String(err?.message ?? err)}` }
  }

  if (!res.ok) {
    return { ok: false, error: `http_${res.status}` }
  }

  let body
  try {
    body = await res.json()
  } catch {
    return { ok: false, error: 'invalid_json' }
  }

  const addresses = Array.isArray(body?.addresses) ? body.addresses : []
  if (addresses.length === 0) {
    return { ok: false, error: 'no_results' }
  }

  const first = addresses[0]
  const latitude = Number(first.y)
  const longitude = Number(first.x)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, error: 'invalid_coordinates' }
  }

  return { ok: true, latitude, longitude }
}
