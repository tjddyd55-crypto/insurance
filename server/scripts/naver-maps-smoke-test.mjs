/**
 * NAVER Maps Geocoding + Static Map smoke / diagnostics.
 * secret·Client ID 원문은 출력하지 않는다.
 *
 * 사용:
 *   node server/scripts/naver-maps-smoke-test.mjs --all
 *   node server/scripts/naver-maps-smoke-test.mjs --geocoding
 *   node server/scripts/naver-maps-smoke-test.mjs --static-map
 *   node server/scripts/naver-maps-smoke-test.mjs --all --railway-development
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getNaverMapsCredentials } from '../lib/naverMapsCredentials.js'
import {
  NAVER_MAPS_GEOCODE_URL,
  NAVER_MAPS_LEGACY_OPENAPI_HOST,
  NAVER_MAPS_STATIC_RASTER_URL,
} from '../lib/naverMapsEndpoints.js'
import { buildNaverStaticMapRequestUrl } from '../lib/customerStaticMapBuilder.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')

const HEADER_KEY_ID = 'x-ncp-apigw-api-key-id'
const HEADER_KEY_SECRET = 'x-ncp-apigw-api-key'

const ENV_KEYS = [
  'NAVER_MAPS_CLIENT_ID',
  'NAVER_MAPS_CLIENT_SECRET',
  'NAVER_GEOCODING_CLIENT_ID',
  'NAVER_GEOCODING_CLIENT_SECRET',
  'MAP_PROVIDER',
  'MAP_RENDER_MODE',
]

/**
 * @param {string} value
 */
function maskSecret(value) {
  const s = String(value ?? '').trim()
  if (!s) return '(empty)'
  if (s.length <= 4) return '****'
  return `${s.slice(0, 2)}****${s.slice(-2)}`
}

/**
 * @param {string} key
 */
function reportEnvKey(key) {
  const raw = String(process.env[key] ?? '')
  const trimmed = raw.trim()
  console.log(
    `${key} exists=${Boolean(trimmed)} length=${raw.length} trimmedLength=${trimmed.length} masked=${maskSecret(trimmed)}`,
  )
  if (raw !== trimmed) console.log(`${key} trim_needed=true`)
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) console.log(`${key} wrapped_quotes=true`)
}

function loadEnvFileIfPresent(root, filename = '.env') {
  const p = path.join(root, filename)
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

function injectRailwayDevelopmentEnv() {
  const railwayJson = spawnSync('railway', ['variables', '--json', '-e', 'development'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (railwayJson.status !== 0) {
    console.error('[naver-maps-smoke-test] railway variables -e development failed')
    process.exit(1)
  }
  const railwayVars = JSON.parse(railwayJson.stdout)
  for (const key of ENV_KEYS) {
    if (railwayVars[key] != null && String(railwayVars[key]).trim()) {
      process.env[key] = String(railwayVars[key])
    }
  }
  return railwayVars
}

function reportRailwayCliLink() {
  const status = spawnSync('railway', ['status'], { encoding: 'utf8', shell: process.platform === 'win32' })
  if (status.status === 0) {
    console.log('[naver-maps-smoke-test] railway status (linked CLI context):')
    console.log(status.stdout.trim())
  }
}

/**
 * @param {unknown} body
 */
function summarizeErrorBody(body) {
  if (body == null) return null
  if (typeof body === 'string') {
    const t = body.trim().slice(0, 300)
    return t || null
  }
  if (typeof body === 'object') {
    const o = /** @type {Record<string, unknown>} */ (body)
    const pick = {}
    for (const k of ['status', 'errorCode', 'errorMessage', 'message', 'code']) {
      if (o[k] != null) pick[k] = o[k]
    }
    return Object.keys(pick).length > 0 ? pick : JSON.stringify(o).slice(0, 300)
  }
  return String(body).slice(0, 300)
}

/**
 * @param {{
 *   label: string
 *   endpointType: 'geocoding' | 'static-map'
 *   method: string
 *   url: string
 *   headers: Record<string, string>
 * }} req
 */
async function runHttpProbe(req) {
  const safeUrl = req.url.split('?')[0]
  console.log(`\n[probe] ${req.label}`)
  console.log(`  endpointType=${req.endpointType}`)
  console.log(`  method=${req.method}`)
  console.log(`  url=${safeUrl}`)
  console.log(`  headerNames=${Object.keys(req.headers).join(', ')}`)
  console.log(
    `  headerValues: ${HEADER_KEY_ID}=[masked length=${req.headers[HEADER_KEY_ID]?.length ?? 0}], ${HEADER_KEY_SECRET}=[masked length=${req.headers[HEADER_KEY_SECRET]?.length ?? 0}]`,
  )
  console.log(`  curlEquivalent:`)
  console.log(`    curl -G "${safeUrl}" \\`)
  for (const [k, v] of Object.entries(req.headers)) {
    console.log(`      -H "${k}: [masked length=${String(v).length}]" \\`)
  }
  if (req.endpointType === 'geocoding') {
    console.log(`      --data-urlencode "query=분당구 불정로 6"`)
  }

  let res
  try {
    res = await fetch(req.url, { method: req.method, headers: req.headers })
  } catch (err) {
    console.log(`  result: network_error message=${String(err?.message ?? err)}`)
    return { ok: false, status: 0, contentType: null, bodySummary: null }
  }

  const contentType = res.headers.get('content-type')
  let bodySummary = null
  if (contentType?.includes('json')) {
    try {
      bodySummary = summarizeErrorBody(await res.json())
    } catch {
      bodySummary = '(invalid json)'
    }
  } else if (!res.ok) {
    try {
      bodySummary = summarizeErrorBody((await res.text()).slice(0, 300))
    } catch {
      bodySummary = null
    }
  }

  console.log(`  httpStatus=${res.status}`)
  console.log(`  contentType=${contentType ?? '(none)'}`)
  if (bodySummary != null) console.log(`  bodySummary=`, bodySummary)
  if (res.ok && req.endpointType === 'static-map') {
    const buf = Buffer.from(await res.arrayBuffer())
    console.log(`  imageByteLength=${buf.length}`)
  }

  return { ok: res.ok, status: res.status, contentType, bodySummary }
}

function parseArgs(argv) {
  const flags = new Set(argv.slice(2))
  const runGeocoding = flags.has('--geocoding') || flags.has('--all') || flags.size === 0
  const runStatic = flags.has('--static-map') || flags.has('--all') || flags.size === 0
  const railwayDevelopment = flags.has('--railway-development')
  return { runGeocoding, runStatic, railwayDevelopment }
}

async function main() {
  const args = parseArgs(process.argv)

  console.log('[naver-maps-smoke-test] executionContext=start')
  console.log(`  node=${process.version}`)
  console.log(`  cwd=${process.cwd()}`)
  console.log(`  railwayDevelopmentInject=${args.railwayDevelopment}`)

  loadEnvFileIfPresent(projectRoot, '.env')
  loadEnvFileIfPresent(path.join(projectRoot, 'server'), '.env')
  loadEnvFileIfPresent(path.join(projectRoot, 'server'), '.env.local')

  if (args.railwayDevelopment) {
    injectRailwayDevelopmentEnv()
    console.log('[naver-maps-smoke-test] envSource=local-files-then-railway-development-overwrite')
  } else {
    console.log('[naver-maps-smoke-test] envSource=local-files-only')
  }

  reportRailwayCliLink()

  console.log('\n[naver-maps-smoke-test] process.env scan:')
  for (const key of ENV_KEYS) reportEnvKey(key)

  const creds = getNaverMapsCredentials()
  const mapsId = String(process.env.NAVER_MAPS_CLIENT_ID ?? '').trim()
  const mapsSecret = String(process.env.NAVER_MAPS_CLIENT_SECRET ?? '').trim()
  const legacyId = String(process.env.NAVER_GEOCODING_CLIENT_ID ?? '').trim()
  const legacySecret = String(process.env.NAVER_GEOCODING_CLIENT_SECRET ?? '').trim()

  let credentialSource = 'none'
  if (mapsId && mapsSecret) credentialSource = 'NAVER_MAPS_*'
  else if (legacyId && legacySecret) credentialSource = 'NAVER_GEOCODING_* (fallback)'

  console.log('\n[naver-maps-smoke-test] credentialsHelper:')
  console.log(`  configured=${creds.configured}`)
  console.log(`  credentialSource=${credentialSource}`)
  console.log(`  clientIdMasked=${maskSecret(creds.clientId)} length=${creds.clientId.length}`)
  console.log(`  clientSecretMasked=${maskSecret(creds.clientSecret)} length=${creds.clientSecret.length}`)
  console.log(`  provider=${String(process.env.MAP_PROVIDER ?? '').trim() || '(unset)'}`)
  console.log(`  renderMode=${String(process.env.MAP_RENDER_MODE ?? '').trim() || '(unset)'}`)

  const authHeaders = {
    [HEADER_KEY_ID]: creds.clientId,
    [HEADER_KEY_SECRET]: creds.clientSecret,
    Accept: 'application/json',
  }

  const legacyGeocodeUrl = `${NAVER_MAPS_LEGACY_OPENAPI_HOST}/map-geocode/v2/geocode?query=${encodeURIComponent('분당구 불정로 6')}`
  const documentedGeocodeUrl = `${NAVER_MAPS_GEOCODE_URL}?query=${encodeURIComponent('분당구 불정로 6')}`

  const staticMarkers = [{ markerNo: 1, latitude: 37.3595963, longitude: 127.1054328 }]
  const documentedStaticUrl = buildNaverStaticMapRequestUrl(staticMarkers, {
    centerLat: 37.3595963,
    centerLng: 127.1054328,
    level: 16,
    width: 300,
    height: 200,
  })
  const legacyStaticUrl = documentedStaticUrl.replace(
    'https://maps.apigw.ntruss.com',
    NAVER_MAPS_LEGACY_OPENAPI_HOST,
  )

  console.log('\n[naver-maps-smoke-test] endpoint inventory:')
  console.log(`  documentedGeocodeHost=${new URL(NAVER_MAPS_GEOCODE_URL).host}`)
  console.log(`  documentedStaticHost=${new URL(NAVER_MAPS_STATIC_RASTER_URL).host}`)
  console.log(`  legacyOpenApiHost=${new URL(NAVER_MAPS_LEGACY_OPENAPI_HOST).host}`)
  console.log(`  staticUsesRasterPath=${documentedStaticUrl.includes('/map-static/v2/raster')}`)
  console.log(`  staticUsesRasterCorsPath=${documentedStaticUrl.includes('/raster-cors')}`)

  /** @type {Array<Promise<{ ok: boolean; status: number }>>} */
  const results = []

  if (args.runGeocoding) {
    results.push(
      runHttpProbe({
        label: 'geocoding-documented-host',
        endpointType: 'geocoding',
        method: 'GET',
        url: documentedGeocodeUrl,
        headers: authHeaders,
      }),
    )
    results.push(
      runHttpProbe({
        label: 'geocoding-legacy-naveropenapi-host',
        endpointType: 'geocoding',
        method: 'GET',
        url: legacyGeocodeUrl,
        headers: authHeaders,
      }),
    )
  }

  if (args.runStatic) {
    const staticHeaders = {
      [HEADER_KEY_ID]: creds.clientId,
      [HEADER_KEY_SECRET]: creds.clientSecret,
      Accept: 'image/png',
    }
    results.push(
      runHttpProbe({
        label: 'static-map-documented-host-raster',
        endpointType: 'static-map',
        method: 'GET',
        url: documentedStaticUrl,
        headers: staticHeaders,
      }),
    )
    results.push(
      runHttpProbe({
        label: 'static-map-legacy-naveropenapi-host-raster',
        endpointType: 'static-map',
        method: 'GET',
        url: legacyStaticUrl,
        headers: staticHeaders,
      }),
    )
  }

  const settled = await Promise.all(results)
  const documentedResults = settled.filter((_, i) => i % 2 === 0)
  const legacyResults = settled.filter((_, i) => i % 2 === 1)
  const documentedOk = documentedResults.every((r) => r.ok)
  const legacyOk = legacyResults.length === 0 || legacyResults.every((r) => r.ok)

  console.log('\n[naver-maps-smoke-test] summary:')
  console.log(`  documentedHostProbesOk=${documentedOk}`)
  console.log(`  legacyHostProbesOk=${legacyOk} (diagnostic only)`)
  console.log(
    documentedOk
      ? '  verdict=PASS documented maps.apigw.ntruss.com endpoints'
      : '  verdict=FAIL check env injection or API console permissions',
  )
  process.exit(documentedOk ? 0 : 1)
}

main().catch((err) => {
  console.error('[naver-maps-smoke-test] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
