import assert from 'node:assert/strict'
import test from 'node:test'
import { runCustomerGeocodeBackfill } from './customerGeocodeBackfill.js'

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
})
