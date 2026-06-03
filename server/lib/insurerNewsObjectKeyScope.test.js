import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { INSURER_R2_ACTIVE_CATEGORY, INSURER_R2_CATEGORY } from './insurerR2Layout.js'
import { buildInsuranceSharedStorageKey, INSURANCE_STORAGE_CATEGORY } from './insuranceStorageLayout.js'
import { assertNewsObjectKeyScoped, resolveInsurerNewsGaCodeForStorage } from './insurerNewsObjectKeyScope.js'

const FIXED = new Date('2026-06-01T12:00:00.000Z')
const GA_CODE_RAW = 'yjasset'
const GA_ID_PATH = '3'
const COMPANY_SLUG = 'meritz'

describe('resolveInsurerNewsGaCodeForStorage', () => {
  test('prefers gaCodeRaw over numeric gaIdPath', () => {
    assert.equal(resolveInsurerNewsGaCodeForStorage(GA_CODE_RAW, GA_ID_PATH), 'yjasset')
  })
})

describe('assertNewsObjectKeyScoped — SSOT insurer/adjuster newsletters', () => {
  const insurerScope = {
    gaIdPath: GA_ID_PATH,
    gaCodeRaw: GA_CODE_RAW,
    storageCategory: INSURER_R2_ACTIVE_CATEGORY,
    companySlug: COMPANY_SLUG,
  }

  const adjusterScope = {
    gaIdPath: GA_ID_PATH,
    gaCodeRaw: GA_CODE_RAW,
    storageCategory: INSURER_R2_CATEGORY.LOSS_ADJUSTER,
    companySlug: 'adjuster-a',
  }

  test('allows insurer-newsletters SSOT key when gaCodeRaw is set', () => {
    const key = buildInsuranceSharedStorageKey({
      gaCode: GA_CODE_RAW,
      category: INSURANCE_STORAGE_CATEGORY.INSURER_NEWSLETTERS,
      insurerCode: COMPANY_SLUG,
      originalName: 'fire-notice.pdf',
      now: FIXED,
    })
    assert.equal(assertNewsObjectKeyScoped(key, insurerScope), true)
  })

  test('rejects insurer SSOT key when only gaIdPath is used (prod regression)', () => {
    const key = buildInsuranceSharedStorageKey({
      gaCode: GA_CODE_RAW,
      category: INSURANCE_STORAGE_CATEGORY.INSURER_NEWSLETTERS,
      insurerCode: COMPANY_SLUG,
      originalName: 'fire-notice.pdf',
      now: FIXED,
    })
    assert.equal(
      assertNewsObjectKeyScoped(key, {
        gaIdPath: GA_ID_PATH,
        storageCategory: INSURER_R2_ACTIVE_CATEGORY,
        companySlug: COMPANY_SLUG,
      }),
      false,
    )
  })

  test('allows adjuster-newsletters SSOT key', () => {
    const key = buildInsuranceSharedStorageKey({
      gaCode: GA_CODE_RAW,
      category: INSURANCE_STORAGE_CATEGORY.ADJUSTER_NEWSLETTERS,
      adjusterCode: 'adjuster-a',
      originalName: 'claim-guide.pdf',
      now: FIXED,
    })
    assert.equal(assertNewsObjectKeyScoped(key, adjusterScope), true)
  })

  test('rejects other GA SSOT key', () => {
    const key = buildInsuranceSharedStorageKey({
      gaCode: 'otherga',
      category: INSURANCE_STORAGE_CATEGORY.INSURER_NEWSLETTERS,
      insurerCode: COMPANY_SLUG,
      originalName: 'x.pdf',
      now: FIXED,
    })
    assert.equal(assertNewsObjectKeyScoped(key, insurerScope), false)
  })

  test('rejects user-scoped SSOT key for newsletter save', () => {
    const key = `insurance/${GA_CODE_RAW}/users/agent-1/customer-files/519/2026/06/1-file.pdf`
    assert.equal(assertNewsObjectKeyScoped(key, insurerScope), false)
  })

  test('rejects wrong company slug in SSOT path', () => {
    const key = buildInsuranceSharedStorageKey({
      gaCode: GA_CODE_RAW,
      category: INSURANCE_STORAGE_CATEGORY.INSURER_NEWSLETTERS,
      insurerCode: 'other-insurer',
      originalName: 'x.pdf',
      now: FIXED,
    })
    assert.equal(assertNewsObjectKeyScoped(key, insurerScope), false)
  })

  test('allows legacy insurer-news path', () => {
    const legacy = `insurer-news/${INSURER_R2_ACTIVE_CATEGORY}/2026/06/${COMPANY_SLUG}/uuid_file.pdf`
    assert.equal(assertNewsObjectKeyScoped(legacy, insurerScope), true)
  })

  test('allows legacy insurer/{gaIdPath}/news path', () => {
    const legacy = `insurer/${GA_ID_PATH}/news/2026/06/${COMPANY_SLUG}/uuid_file.pdf`
    assert.equal(assertNewsObjectKeyScoped(legacy, insurerScope), true)
  })
})
