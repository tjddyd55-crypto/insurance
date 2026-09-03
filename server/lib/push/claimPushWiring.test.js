import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('claim push wiring contracts', () => {
  it('ensures user_push_devices and outbox schema', () => {
    const init = read('server/initDb.js')
    assert.match(init, /CREATE TABLE IF NOT EXISTS user_push_devices/)
    assert.match(init, /CREATE TABLE IF NOT EXISTS notification_push_outbox/)
    assert.match(init, /uq_notification_push_outbox_dedupe_recipient/)
  })

  it('registers push device API and outbox worker', () => {
    const index = read('server/index.js')
    assert.match(index, /registerPushDevicesApi/)
    assert.match(index, /processPendingPushOutbox/)
  })

  it('enqueues push after claim commit without failing claim', () => {
    const api = read('server/apis/customerClaimAppApi.js')
    assert.match(api, /await client\.query\('COMMIT'\)/)
    assert.match(api, /enqueueClaimSubmittedPush/)
    assert.match(api, /void enqueueClaimSubmittedPush/)
    assert.match(api, /gaId: claimGaId/)
    assert.match(api, /enqueueClaimReceivedAlimtalk/)
    assert.match(api, /hasFiles/)
  })

  it('uses claim-submitted dedupe key', () => {
    const push = read('server/lib/push/claimSubmittedPush.js')
    assert.match(push, /claim-submitted:\$\{claimRequestId\}:\$\{recipientUserId\}/)
    assert.match(push, /CUSTOMER_CLAIM_SUBMITTED/)
    assert.match(push, /buildInternalCustomerClaimRoute/)
  })

  it('enqueues customer-created push after invite registration without removing kakao', () => {
    const index = read('server/index.js')
    assert.match(index, /enqueueCustomerRegistrationCompletedAlimtalk/)
    assert.match(index, /createCustomerCreatedNotification/)
    assert.match(index, /enqueueCustomerCreatedPush/)
  })

  // Mobile client push helpers live on a separate track; this Phase 1 port is server-only.
  it('keeps production Android package identity available for FCM targeting', () => {
    const appJson = read('apps/mobile/app.json')
    assert.match(appJson, /"package": "com\.onefc\.app"/)
  })
})
