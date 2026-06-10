const GEOCODE_URL = 'https://dapi.kakao.com/v2/local/search/address.json'

/**
 * @returns {{ configured: boolean; restApiKey: string }}
 */
export function getKakaoGeocodingCredentials() {
  const restApiKey = String(process.env.KAKAO_REST_API_KEY ?? '').trim()
  return {
    configured: Boolean(restApiKey),
    restApiKey,
  }
}

/**
 * @param {string} query
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ ok: true; latitude: number; longitude: number } | { ok: false; error: string }>}
 */
export async function geocodeWithKakao(query, options = {}) {
  const { configured, restApiKey } = getKakaoGeocodingCredentials()
  if (!configured) {
    return { ok: false, error: 'kakao_geocoding_not_configured' }
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
        Authorization: `KakaoAK ${restApiKey}`,
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

  const documents = Array.isArray(body?.documents) ? body.documents : []
  if (documents.length === 0) {
    return { ok: false, error: 'no_results' }
  }

  const first = documents[0]
  const latitude = Number(first.y ?? first.latitude)
  const longitude = Number(first.x ?? first.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, error: 'invalid_coordinates' }
  }

  return { ok: true, latitude, longitude }
}
