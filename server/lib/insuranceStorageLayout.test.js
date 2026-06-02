import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  INSURANCE_STORAGE_CATEGORY,
  assertInsuranceSharedStorageKey,
  assertInsuranceTeamStorageKey,
  assertInsuranceUserOrLegacyStorageKey,
  assertInsuranceUserStorageKey,
  buildInsuranceSharedStorageKey,
  buildInsuranceTeamStorageKey,
  buildInsuranceUserStorageKey,
} from './insuranceStorageLayout.js'

const FIXED = new Date('2026-06-01T12:00:00.000Z')

describe('insuranceStorageLayout builders', () => {
  test('customer-files key matches SSOT path', () => {
    const key = buildInsuranceUserStorageKey({
      gaCode: 'yjasset',
      userId: '5c2d72a2-7b4d-4b5f-a505-81d5e5018e87',
      category: INSURANCE_STORAGE_CATEGORY.CUSTOMER_FILES,
      customerId: 519,
      originalName: 'jangyumi-analysis.pdf',
      now: FIXED,
    })
    assert.match(
      key,
      /^insurance\/yjasset\/users\/5c2d72a2-7b4d-4b5f-a505-81d5e5018e87\/customer-files\/519\/2026\/06\/\d+-jangyumi-analysis\.pdf$/,
    )
  })

  test('personal-files key', () => {
    const key = buildInsuranceUserStorageKey({
      gaCode: 'yjasset',
      userId: '5c2d72a2-7b4d-4b5f-a505-81d5e5018e87',
      category: INSURANCE_STORAGE_CATEGORY.PERSONAL_FILES,
      originalName: 'my-document.pdf',
      now: FIXED,
    })
    assert.match(key, /^insurance\/yjasset\/users\/5c2d72a2-7b4d-4b5f-a505-81d5e5018e87\/personal-files\/2026\/06\/\d+-my-document\.pdf$/)
  })

  test('customer-claim-app-files key', () => {
    const key = buildInsuranceUserStorageKey({
      gaCode: 'yjasset',
      userId: '5c2d72a2-7b4d-4b5f-a505-81d5e5018e87',
      category: INSURANCE_STORAGE_CATEGORY.CUSTOMER_CLAIM_APP_FILES,
      customerId: 519,
      claimId: 'claim_123',
      originalName: 'hospital-receipt.pdf',
      now: FIXED,
    })
    assert.match(
      key,
      /^insurance\/yjasset\/users\/5c2d72a2-7b4d-4b5f-a505-81d5e5018e87\/customer-claim-app-files\/519\/claim_123\/2026\/06\/\d+-hospital-receipt\.pdf$/,
    )
  })

  test('customer-messages key', () => {
    const key = buildInsuranceUserStorageKey({
      gaCode: 'yjasset',
      userId: '5c2d72a2-7b4d-4b5f-a505-81d5e5018e87',
      category: INSURANCE_STORAGE_CATEGORY.CUSTOMER_MESSAGES,
      customerId: 519,
      messageId: 'msg_123',
      originalName: 'message-attach.pdf',
      now: FIXED,
    })
    assert.match(
      key,
      /^insurance\/yjasset\/users\/5c2d72a2-7b4d-4b5f-a505-81d5e5018e87\/customer-messages\/519\/msg_123\/2026\/06\/\d+-message-attach\.pdf$/,
    )
  })

  test('customer-newsletters key', () => {
    const key = buildInsuranceUserStorageKey({
      gaCode: 'yjasset',
      userId: 'agent-1',
      category: INSURANCE_STORAGE_CATEGORY.CUSTOMER_NEWSLETTERS,
      customerId: 519,
      newsletterId: 'news_123',
      originalName: 'customer-news.pdf',
      now: FIXED,
    })
    assert.match(key, /\/customer-newsletters\/519\/news_123\/2026\/06\/\d+-customer-news\.pdf$/)
  })

  test('shared customer-newsletters key', () => {
    const key = buildInsuranceSharedStorageKey({
      gaCode: 'yjasset',
      category: INSURANCE_STORAGE_CATEGORY.SHARED_CUSTOMER_NEWSLETTERS,
      newsletterId: 'news_202606',
      originalName: 'ga-customer-news.pdf',
      now: FIXED,
    })
    assert.match(key, /^insurance\/yjasset\/shared\/customer-newsletters\/news_202606\/2026\/06\/\d+-ga-customer-news\.pdf$/)
  })

  test('insurer-newsletters key', () => {
    const key = buildInsuranceSharedStorageKey({
      gaCode: 'yjasset',
      category: INSURANCE_STORAGE_CATEGORY.INSURER_NEWSLETTERS,
      insurerCode: 'meritz',
      originalName: 'fire-notice.pdf',
      now: FIXED,
    })
    assert.match(key, /^insurance\/yjasset\/shared\/insurer-newsletters\/meritz\/2026\/06\/\d+-fire-notice\.pdf$/)
  })

  test('adjuster-newsletters key', () => {
    const key = buildInsuranceSharedStorageKey({
      gaCode: 'yjasset',
      category: INSURANCE_STORAGE_CATEGORY.ADJUSTER_NEWSLETTERS,
      adjusterCode: 'adjuster-a',
      originalName: 'claim-guide.pdf',
      now: FIXED,
    })
    assert.match(key, /^insurance\/yjasset\/shared\/adjuster-newsletters\/adjuster-a\/2026\/06\/\d+-claim-guide\.pdf$/)
  })

  test('team-files key', () => {
    const key = buildInsuranceTeamStorageKey({
      gaCode: 'yjasset',
      teamId: 'team-42',
      originalName: 'team-doc.pdf',
      now: FIXED,
    })
    assert.match(key, /^insurance\/yjasset\/teams\/team-42\/team-files\/2026\/06\/\d+-team-doc\.pdf$/)
  })
})

describe('insuranceStorageLayout assert + legacy', () => {
  test('legacy insurer customer file still allowed', () => {
    const legacy =
      'platform-assets/insurer/yjasset/agent1/files/storage/2024/01/1700000000_test.pdf'
    assert.equal(
      assertInsuranceUserOrLegacyStorageKey(legacy, ['yjasset'], 'agent1', { customerId: 1 }),
      true,
    )
  })

  test('assertInsuranceUserStorageKey rejects wrong user', () => {
    const key = buildInsuranceUserStorageKey({
      gaCode: 'yjasset',
      userId: 'user-a',
      category: INSURANCE_STORAGE_CATEGORY.PERSONAL_FILES,
      originalName: 'a.pdf',
      now: FIXED,
    })
    assert.equal(assertInsuranceUserStorageKey(key, 'yjasset', 'user-b', INSURANCE_STORAGE_CATEGORY.PERSONAL_FILES), false)
  })

  test('shared insurer legacy insurer-news path', () => {
    const legacy = 'insurer-news/news/2026/06/meritz/uuid_file.pdf'
    assert.equal(
      assertInsuranceSharedStorageKey(legacy, 'yjasset', INSURANCE_STORAGE_CATEGORY.INSURER_NEWSLETTERS, {
        companySlug: 'meritz',
      }),
      true,
    )
  })

  test('team legacy attachments path', () => {
    const legacy = 'teams/3/team-1/attachments/uuid-file.pdf'
    assert.equal(assertInsuranceTeamStorageKey(legacy, '3', 'team-1'), true)
  })
})
