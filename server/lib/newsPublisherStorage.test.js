import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { buildInsuranceSharedStorageKey, INSURANCE_STORAGE_CATEGORY } from './insuranceStorageLayout.js'
import { assertNewsObjectKeyScoped } from './insurerNewsObjectKeyScope.js'
import { INSURER_R2_CATEGORY } from './insurerR2Layout.js'
import { newsPublisherStorageSlug } from './newsPublisherStorage.js'

const FIXED = new Date('2026-06-01T12:00:00.000Z')
const GA_CODE_RAW = 'yjasset'
const GA_ID_PATH = '3'

describe('newsPublisherStorageSlug', () => {
  test('presign scope slug matches assert for Korean loss adjuster name', () => {
    const companySlug = newsPublisherStorageSlug('한국 손해사정', 'loss-adjuster')
    const key = buildInsuranceSharedStorageKey({
      gaCode: GA_CODE_RAW,
      category: INSURANCE_STORAGE_CATEGORY.ADJUSTER_NEWSLETTERS,
      adjusterCode: companySlug,
      originalName: 'notice.png',
      now: FIXED,
    })
    assert.equal(
      assertNewsObjectKeyScoped(key, {
        gaIdPath: GA_ID_PATH,
        gaCodeRaw: GA_CODE_RAW,
        storageCategory: INSURER_R2_CATEGORY.LOSS_ADJUSTER,
        companySlug,
        allowLegacyLossAdjusterCategory: true,
      }),
      true,
    )
  })

  test('empty display name uses channel fallback slug', () => {
    assert.equal(newsPublisherStorageSlug('', 'loss-adjuster'), 'loss-adjuster')
    assert.equal(newsPublisherStorageSlug('   ', 'insurer'), 'insurer')
  })
})
