import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { buildInsuranceSharedStorageKey, INSURANCE_STORAGE_CATEGORY } from './insuranceStorageLayout.js'
import { assertNewsObjectKeyScoped } from './insurerNewsObjectKeyScope.js'
import { INSURER_R2_ACTIVE_CATEGORY, INSURER_R2_CATEGORY } from './insurerR2Layout.js'

const FIXED = new Date('2026-06-01T12:00:00.000Z')

describe('newsletter delete — attachment key scope', () => {
  const insurerScope = {
    gaIdPath: '3',
    gaCodeRaw: 'yjasset',
    storageCategory: INSURER_R2_ACTIVE_CATEGORY,
    companySlug: 'meritz',
  }

  test('allows SSOT insurer-newsletters key before R2 delete', () => {
    const key = buildInsuranceSharedStorageKey({
      gaCode: 'yjasset',
      category: INSURANCE_STORAGE_CATEGORY.INSURER_NEWSLETTERS,
      insurerCode: 'meritz',
      originalName: 'notice.pdf',
      now: FIXED,
    })
    assert.equal(assertNewsObjectKeyScoped(key, { ...insurerScope, allowLegacyLossAdjusterCategory: true }), true)
  })

  test('rejects customer-files key', () => {
    const key = 'insurance/yjasset/users/u1/customer-files/1/2026/06/1-a.pdf'
    assert.equal(assertNewsObjectKeyScoped(key, { ...insurerScope, allowLegacyLossAdjusterCategory: true }), false)
  })

  test('allows adjuster SSOT key', () => {
    const key = buildInsuranceSharedStorageKey({
      gaCode: 'yjasset',
      category: INSURANCE_STORAGE_CATEGORY.ADJUSTER_NEWSLETTERS,
      adjusterCode: 'adjuster-a',
      originalName: 'guide.pdf',
      now: FIXED,
    })
    const scope = {
      gaIdPath: '3',
      gaCodeRaw: 'yjasset',
      storageCategory: INSURER_R2_CATEGORY.LOSS_ADJUSTER,
      companySlug: 'adjuster-a',
    }
    assert.equal(assertNewsObjectKeyScoped(key, { ...scope, allowLegacyLossAdjusterCategory: true }), true)
  })
})
