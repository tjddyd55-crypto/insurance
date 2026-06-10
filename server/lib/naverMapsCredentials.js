/**
 * 네이버 Maps(Geocoding + Static Map) 서버 전용 자격 증명.
 *
 * 1순위: NAVER_MAPS_CLIENT_ID / NAVER_MAPS_CLIENT_SECRET
 * 2순위: NAVER_GEOCODING_CLIENT_ID / NAVER_GEOCODING_CLIENT_SECRET (레거시)
 */
export function getNaverMapsCredentials() {
  const clientId = String(
    process.env.NAVER_MAPS_CLIENT_ID ?? process.env.NAVER_GEOCODING_CLIENT_ID ?? '',
  ).trim()
  const clientSecret = String(
    process.env.NAVER_MAPS_CLIENT_SECRET ?? process.env.NAVER_GEOCODING_CLIENT_SECRET ?? '',
  ).trim()
  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
  }
}
