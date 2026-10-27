import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getDefaultUserNotificationSettings,
  getUserNotificationSettings,
  upsertUserNotificationSettings,
} from '../services/userNotificationSettingsService.js'

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

test('saved notification values are restored by user and GA after a fresh read', async () => {
  const rows = new Map()
  const db = {
    async query(sql, params) {
      if (sql.includes('INSERT INTO user_notification_settings')) {
        const [userId, gaId, appPush, newCustomer, customerAppFile, workAlert, ageOn, ageDays, carOn, carDays, dateOn, dateDays, claimOn] = params
        const row = {
          app_push_enabled: appPush,
          new_customer_enabled: newCustomer,
          customer_app_file_enabled: customerAppFile,
          work_alert_enabled: workAlert,
          insurance_age_enabled: ageOn,
          insurance_age_days_before: ageDays,
          car_expiry_enabled: carOn,
          car_expiry_days_before: carDays,
          special_date_enabled: dateOn,
          special_date_days_before: dateDays,
          claim_request_enabled: claimOn,
        }
        rows.set(`${gaId}:${userId}`, row)
        return { rows: [row] }
      }

      if (sql.includes('FROM user_notification_settings')) {
        const [userId, gaId] = params
        const row = rows.get(`${gaId}:${userId}`)
        return { rows: row ? [row] : [] }
      }

      throw new Error(`Unexpected settings query: ${sql}`)
    },
  }
  const settings = {
    ...getDefaultUserNotificationSettings(),
    insuranceAge: { enabled: false, daysBefore: 10 },
    carExpiry: { enabled: false, daysBefore: 14 },
    specialDate: { enabled: false, daysBefore: 7 },
    claimRequest: { enabled: false },
  }

  await upsertUserNotificationSettings(db, 'advisor-1', 42, settings)

  assert.deepEqual(await getUserNotificationSettings(db, 'advisor-1', 42), settings)
  assert.deepEqual(await getUserNotificationSettings(db, 'advisor-2', 42), getDefaultUserNotificationSettings())
})
