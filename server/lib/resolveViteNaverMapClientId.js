/**
 * Vite build-time bridge for Dynamic Map public Client ID.
 *
 * Application code reads only `import.meta.env.VITE_NAVER_MAP_CLIENT_ID` (inlined by Vite).
 * Railway dev often sets `NAVER_MAPS_CLIENT_ID` for server geocoding without duplicating
 * the VITE_ variable — this copies the server key into the client bundle at build time.
 *
 * Priority: VITE_NAVER_MAP_CLIENT_ID > NAVER_MAPS_CLIENT_ID
 */
export function resolveViteNaverMapClientId(env = process.env) {
  const fromVite = String(env.VITE_NAVER_MAP_CLIENT_ID ?? '').trim()
  if (fromVite) {
    return fromVite
  }
  return String(env.NAVER_MAPS_CLIENT_ID ?? '').trim()
}
