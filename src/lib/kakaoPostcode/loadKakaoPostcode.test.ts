import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'loadKakaoPostcode.ts'),
  'utf8',
)

const addressFieldSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../components/form/AddressSearchField.tsx'),
  'utf8',
)

test('postcode loader uses current kakaocdn script URL', () => {
  assert.match(src, /t1\.kakaocdn\.net\/mapjsapi\/bundle\/postcode\/prod\/postcode\.v2\.js/)
  assert.doesNotMatch(src, /ssl\.daumcdn\.net/)
})

test('postcode loader resolves kakao and daum namespaces', () => {
  assert.match(src, /window\.kakao\?\.Postcode/)
  assert.match(src, /window\.daum\?\.Postcode/)
})

test('failed script is removed and loader can reset for retry', () => {
  assert.match(src, /resetKakaoPostcodeLoader/)
  assert.match(src, /removeStalePostcodeScripts/)
  assert.match(src, /failed/)
  assert.match(src, /script\.remove\(\)/)
  assert.match(src, /loadingPromise = null/)
})

test('AddressSearchField exposes retry after load failure', () => {
  assert.match(addressFieldSrc, /resetKakaoPostcodeLoader/)
  assert.match(addressFieldSrc, /다시 시도/)
})
