import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const serviceSource = fs.readFileSync(path.join(root, 'services/userNotificationService.js'), 'utf8')
const settingsSource = fs.readFileSync(
  path.join(root, 'services/userNotificationSettingsService.js'),
  'utf8',
)

test('syncDueUserNotifications loads user settings before creating due alerts', () => {
  assert.match(serviceSource, /getUserNotificationSettings/)
  assert.match(serviceSource, /settings\.insuranceAge/)
  assert.match(serviceSource, /settings\.carExpiry/)
  assert.match(serviceSource, /settings\.specialDate/)
  assert.match(serviceSource, /settings\.claimRequest\.enabled/)
})

test('claim request create respects claimRequest.enabled', () => {
  assert.match(serviceSource, /createClaimRequestReceivedNotification/)
  assert.match(serviceSource, /if \(!settings\.claimRequest\.enabled\)/)
})

test('special date sync uses special_date_id unique conflict target', () => {
  assert.match(serviceSource, /SPECIAL_DATE/)
  assert.match(serviceSource, /ON CONFLICT \(user_id, ga_id, type, special_date_id, target_date\)/)
  assert.match(serviceSource, /computeNextAnnualOccurrence/)
})

test('settings service upserts user_notification_settings table', () => {
  assert.match(settingsSource, /user_notification_settings/)
  assert.match(settingsSource, /ON CONFLICT \(ga_id, user_id\)/)
  assert.match(settingsSource, /insurance_age_days_before/)
  assert.match(settingsSource, /car_expiry_days_before/)
  assert.match(settingsSource, /special_date_days_before/)
  assert.match(settingsSource, /claim_request_enabled/)
})
