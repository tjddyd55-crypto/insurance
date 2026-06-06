import assert from 'node:assert/strict'
import test from 'node:test'
import { geocodeCustomerAddress, resolvePreferredGeocodingProvider } from './customerGeocodingProvider.js'

const ENV_KEYS = [
  'MAP_GEOCODING_PROVIDER',
  'VITE_MAP_PROVIDER',
  'NAVER_GEOCODING_CLIENT_ID',
  'NAVER_GEOCODING_CLIENT_SECRET',
  'KAKAO_REST_API_KEY',
]

function snapshotEnv() {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
}

function restoreEnv(snapshot) {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = snapshot[key]
    }
  }
}

test('resolvePreferredGeocodingProvider defaults to naver', () => {
  const prev = snapshotEnv()
  try {
    for (const key of ENV_KEYS) {
      delete process.env[key]
    }
    assert.equal(resolvePreferredGeocodingProvider(), 'naver')
    process.env.VITE_MAP_PROVIDER = 'kakao'
    assert.equal(resolvePreferredGeocodingProvider(), 'kakao')
  } finally {
    restoreEnv(prev)
  }
})

test('geocodeCustomerAddress falls back from naver to kakao', async () => {
  const prev = snapshotEnv()
  try {
    delete process.env.NAVER_GEOCODING_CLIENT_ID
    delete process.env.NAVER_GEOCODING_CLIENT_SECRET
    process.env.KAKAO_REST_API_KEY = 'test-key'

    const fetchImpl = async (url) => {
      assert.match(String(url), /kakao\.com/)
      return {
        ok: true,
        async json() {
          return { documents: [{ y: '37.5', x: '127.0' }] }
        },
      }
    }

    const result = await geocodeCustomerAddress('서울시 중구', { fetchImpl })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.provider, 'kakao')
      assert.equal(result.latitude, 37.5)
      assert.equal(result.longitude, 127)
    }
  } finally {
    restoreEnv(prev)
  }
})

test('geocodeCustomerAddress returns error when no provider configured', async () => {
  const prev = snapshotEnv()
  try {
    for (const key of ENV_KEYS) {
      delete process.env[key]
    }
    const result = await geocodeCustomerAddress('서울')
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.match(result.error, /not_configured/)
    }
  } finally {
    restoreEnv(prev)
  }
})
