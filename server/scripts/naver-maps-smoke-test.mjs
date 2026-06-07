/**
 * NAVER Maps Geocoding + Static Map 키 smoke test.
 * secret 값은 출력하지 않는다.
 *
 * 사용:
 *   node server/scripts/naver-maps-smoke-test.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { geocodeWithNaver } from '../lib/customerGeocodingNaver.js'
import { fetchNaverStaticMapImage } from '../lib/customerStaticMapBuilder.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')

function loadEnvFileIfPresent(root, filename = '.env') {
  const p = path.join(root, filename)
  if (!fs.existsSync(p)) {
    return
  }
  const raw = fs.readFileSync(p, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) {
      continue
    }
    const i = t.indexOf('=')
    if (i === -1) {
      continue
    }
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = val
    }
  }
}

function reportEnvPresence() {
  const keys = [
    'NAVER_MAPS_CLIENT_ID',
    'NAVER_MAPS_CLIENT_SECRET',
    'MAP_PROVIDER',
    'MAP_RENDER_MODE',
  ]
  console.log('[naver-maps-smoke-test] env presence:')
  for (const key of keys) {
    const raw = String(process.env[key] ?? '')
    const trimmed = raw.trim()
    console.log(`${key} exists=${Boolean(trimmed)} length=${trimmed.length}`)
    if (raw !== trimmed) {
      console.log(`${key} trim_needed=true`)
    }
    if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
      console.log(`${key} wrapped_quotes=true`)
    }
  }

  const id = String(process.env.NAVER_MAPS_CLIENT_ID ?? '').trim()
  const secret = String(process.env.NAVER_MAPS_CLIENT_SECRET ?? '').trim()
  if (id && secret && id === secret) {
    console.log('client_id_secret_same=true')
  }
}

async function main() {
  loadEnvFileIfPresent(projectRoot, '.env')
  loadEnvFileIfPresent(path.join(projectRoot, 'server'), '.env')
  loadEnvFileIfPresent(path.join(projectRoot, 'server'), '.env.local')

  reportEnvPresence()

  const geocode = await geocodeWithNaver('분당구 불정로 6')
  if (geocode.ok) {
    console.log('[naver-maps-smoke-test] geocoding: ok', {
      latitude: geocode.latitude,
      longitude: geocode.longitude,
    })
  } else {
    console.log('[naver-maps-smoke-test] geocoding: fail', { error: geocode.error })
  }

  const staticMap = await fetchNaverStaticMapImage(
    [{ markerNo: 1, latitude: 37.3595963, longitude: 127.1054328 }],
    { centerLat: 37.3595963, centerLng: 127.1054328, useExplicitCenter: true },
  )
  if (staticMap.ok) {
    console.log('[naver-maps-smoke-test] static-map: ok', {
      contentType: staticMap.contentType,
      byteLength: staticMap.buffer?.length ?? 0,
    })
  } else {
    console.log('[naver-maps-smoke-test] static-map: fail', { error: staticMap.error })
  }
}

main().catch((err) => {
  console.error('[naver-maps-smoke-test] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
