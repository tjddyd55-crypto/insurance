import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveViteNaverMapClientId } from './resolveViteNaverMapClientId.js'

test('resolveViteNaverMapClientId prefers VITE_NAVER_MAP_CLIENT_ID', () => {
  assert.equal(
    resolveViteNaverMapClientId({
      VITE_NAVER_MAP_CLIENT_ID: ' vite-key ',
      NAVER_MAPS_CLIENT_ID: 'server-key',
    }),
    'vite-key',
  )
})

test('resolveViteNaverMapClientId bridges NAVER_MAPS_CLIENT_ID when VITE is unset', () => {
  assert.equal(
    resolveViteNaverMapClientId({
      NAVER_MAPS_CLIENT_ID: 'server-only-key',
    }),
    'server-only-key',
  )
})

test('resolveViteNaverMapClientId returns empty when neither is set', () => {
  assert.equal(resolveViteNaverMapClientId({}), '')
})
