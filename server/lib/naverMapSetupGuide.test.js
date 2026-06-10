import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatNaverMapAuthFailureMessage,
  NAVER_MAP_WEB_SERVICE_URLS,
} from '../../src/features/customers/config/naverMapSetupGuide.ts'

test('NAVER_MAP_WEB_SERVICE_URLS includes dev and prod Railway hosts', () => {
  assert.ok(NAVER_MAP_WEB_SERVICE_URLS.includes('https://insurance-dev.up.railway.app'))
  assert.ok(NAVER_MAP_WEB_SERVICE_URLS.includes('https://insurance-production-7bd8.up.railway.app'))
})

test('formatNaverMapAuthFailureMessage includes origin and Web Service URL hint', () => {
  const message = formatNaverMapAuthFailureMessage('https://insurance-dev.up.railway.app')
  assert.match(message, /insurance-dev\.up\.railway\.app/)
  assert.match(message, /Web 서비스 URL/)
  assert.match(message, /VITE_NAVER_MAP_CLIENT_ID/)
})
