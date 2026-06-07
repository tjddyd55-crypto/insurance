import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isRetryableNotConfiguredFailed,
  runCustomerGeocodeBackfill,
  shouldSkipFailedCustomerLocation,
} from './customerGeocodeBackfill.js'

test('isRetryableNotConfiguredFailed matches provider not_configured errors', () => {
  assert.equal(isRetryableNotConfiguredFailed('naver:not_configured;kakao:not_configured'), true)
  assert.equal(isRetryableNotConfiguredFailed('naver:zero_results'), false)
  assert.equal(isRetryableNotConfiguredFailed(null), false)
})

test('shouldSkipFailedCustomerLocation skips failed by default', () => {
  assert.equal(
    shouldSkipFailedCustomerLocation({
      prevStatus: 'failed',
      prevErrorMessage: 'naver:not_configured;kakao:not_configured',
      retryFailed: false,
    }),
    true,
  )
  assert.equal(
    shouldSkipFailedCustomerLocation({
      prevStatus: 'failed',
      prevErrorMessage: 'naver:zero_results',
      retryFailed: true,
    }),
    true,
  )
  assert.equal(
    shouldSkipFailedCustomerLocation({
      prevStatus: 'failed',
      prevErrorMessage: 'naver:not_configured;kakao:not_configured',
      retryFailed: true,
    }),
    false,
  )
  assert.equal(
    shouldSkipFailedCustomerLocation({
      prevStatus: 'pending',
      prevErrorMessage: null,
      retryFailed: false,
    }),
    false,
  )
})

test('runCustomerGeocodeBackfill dry-run counts targets without writes', async () => {
  const pool = {
    async query(_sql, _params) {
      return {
        rowCount: 2,
        rows: [
          {
            customer_id: 1,
            user_id: 'u1',
            ga_id: 2,
            address: '',
            location_status: null,
            address_snapshot: null,
          },
          {
            customer_id: 2,
            user_id: 'u1',
            ga_id: 2,
            address: '(06234) 서울특별시 강남구 테헤란로 152',
            location_status: 'success',
            address_snapshot: '(06234) 서울특별시 강남구 테헤란로 152',
          },
        ],
      }
    },
  }

  const summary = await runCustomerGeocodeBackfill(pool, { limit: 10 })
  assert.equal(summary.dryRun, true)
  assert.equal(summary.target, 2)
  assert.equal(summary.skippedNoAddress, 1)
  assert.equal(summary.alreadyHave, 1)
  assert.equal(summary.pendingWouldRun, 0)
  assert.equal(summary.skippedFailed, 0)
})

test('runCustomerGeocodeBackfill dry-run skips failed unless retry-failed', async () => {
  const pool = {
    async query(_sql, _params) {
      return {
        rowCount: 2,
        rows: [
          {
            customer_id: 14,
            user_id: 'u1',
            ga_id: 2,
            address: '(06234) 서울특별시 강남구 테헤란로 152',
            location_status: 'failed',
            address_snapshot: '(06234) 서울특별시 강남구 테헤란로 152',
            error_message: 'naver:not_configured;kakao:not_configured',
          },
          {
            customer_id: 15,
            user_id: 'u1',
            ga_id: 2,
            address: '(04524) 서울특별시 중구 세종대로 110',
            location_status: null,
            address_snapshot: null,
            error_message: null,
          },
        ],
      }
    },
  }

  const withoutRetry = await runCustomerGeocodeBackfill(pool, { limit: 10 })
  assert.equal(withoutRetry.skippedFailed, 1)
  assert.equal(withoutRetry.pendingWouldRun, 1)

  const withRetry = await runCustomerGeocodeBackfill(pool, { limit: 10, retryFailed: true })
  assert.equal(withRetry.skippedFailed, 0)
  assert.equal(withRetry.pendingWouldRun, 2)
})
