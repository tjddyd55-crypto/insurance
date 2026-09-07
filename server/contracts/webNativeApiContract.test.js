import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  parseNativeCreateCustomerRelation,
  parseNativeLoginSession,
  parseNativeNotificationList,
  parseNativeNotificationSettings,
  parseWebCreateCustomerRelation,
  parseWebLoginSession,
  parseWebNotificationSettingsEnvelope,
} from './apiContractParsers.js'

const dir = dirname(fileURLToPath(import.meta.url))
const fixtures = join(dir, 'fixtures')

function loadFixture(name) {
  return JSON.parse(readFileSync(join(fixtures, name), 'utf8'))
}

test('login response: web and native agree on core session fields', () => {
  const fixture = loadFixture('login-response.json')
  const web = parseWebLoginSession(fixture)
  const native = parseNativeLoginSession(fixture)
  assert.equal(web.token, native.token)
  assert.equal(web.userId, native.userId)
  assert.equal(web.username, native.username)
  assert.equal(web.role, native.role)
  assert.equal(web.gaId, native.gaId)
  assert.equal(web.gaCode, native.gaCode)
  assert.equal(web.displayName, native.displayName)
})

test('login response: web preserves CRM bridge fields native currently ignores', () => {
  const fixture = loadFixture('login-response.json')
  const web = parseWebLoginSession(fixture)
  assert.equal(web.crmIndustryCode, 'insurance')
  assert.equal(web.hasTenantCrm, true)
  const native = parseNativeLoginSession(fixture)
  assert.equal(native.crmIndustryCode, null)
  assert.equal(native.hasTenantCrm, false)
})

test('login contract C-02: classified as future-native drift (Web CRM bridge only)', () => {
  const webAuthApi = readFileSync(join(dir, '../../src/features/auth/authApi.ts'), 'utf8')
  assert.match(webAuthApi, /crm_industry_code/)
  assert.match(webAuthApi, /tenant_crm/)

  const nativeAuthApiPath = join(dir, '../../../insurance-mobile/src/api/authApi.ts')
  if (!existsSync(nativeAuthApiPath)) {
    return
  }
  const nativeAuthApi = readFileSync(nativeAuthApiPath, 'utf8')
  assert.equal(nativeAuthApi.includes('crm_industry_code'), false)
  assert.equal(nativeAuthApi.includes('tenant_crm'), false)
})

test('customer relations POST: web and native both accept ack payload', () => {
  const fixture = loadFixture('customer-relations-post.json')
  const web = parseWebCreateCustomerRelation(fixture)
  const native = parseNativeCreateCustomerRelation(fixture, 520)
  assert.deepEqual(web, { customerId: 519, relatedCustomerId: 520 })
  assert.deepEqual(native, { customerId: 519, relatedCustomerId: 520, mode: 'ack' })
})

test('notification settings: native parses full server payload', () => {
  const fixture = loadFixture('notification-settings.json')
  const settings = parseNativeNotificationSettings(fixture.data)
  assert.equal(settings.appPush.enabled, true)
  assert.equal(settings.newCustomer.enabled, false)
  assert.equal(settings.carExpiry.daysBefore, 14)
})

test('notification settings: web subset stays compatible with native shared fields', () => {
  const fixture = loadFixture('notification-settings.json')
  const native = parseNativeNotificationSettings(fixture.data)
  const web = parseWebNotificationSettingsEnvelope(fixture)
  assert.deepEqual(web.insuranceAge, native.insuranceAge)
  assert.deepEqual(web.carExpiry, native.carExpiry)
  assert.deepEqual(web.specialDate, native.specialDate)
  assert.deepEqual(web.claimRequest, native.claimRequest)
})

test('notification list fixture: native parser accepts server list envelope', () => {
  const fixture = loadFixture('notification-list.json')
  const parsed = parseNativeNotificationList(fixture)
  assert.equal(parsed.count, 1)
  assert.equal(parsed.firstType, 'claim_request_received')
  assert.equal(parsed.settings.claimRequest.enabled, true)
})

test('native relations client handles ack response without legacy row fields', () => {
  const nativeApiPath = join(
    dir,
    '../../../insurance-mobile/src/features/customers/customerRelationsApi.ts',
  )
  if (!existsSync(nativeApiPath)) {
    return
  }
  const source = readFileSync(nativeApiPath, 'utf8')
  assert.match(source, /item\.ok === true/)
  assert.match(source, /listCustomerRelations\(token, customerId\)/)
})
