import assert from 'node:assert/strict'
import test from 'node:test'

import { isMockPaymentAllowed } from './config.js'

test('mock payment allowed only outside production runtime', () => {
  const prevProvider = process.env.INSURANCE_BILLING_PROVIDER
  const prevName = process.env.RAILWAY_ENVIRONMENT_NAME
  process.env.INSURANCE_BILLING_PROVIDER = 'mock'
  process.env.RAILWAY_ENVIRONMENT_NAME = 'development'
  try {
    assert.equal(isMockPaymentAllowed(), true)
  } finally {
    if (prevProvider == null) delete process.env.INSURANCE_BILLING_PROVIDER
    else process.env.INSURANCE_BILLING_PROVIDER = prevProvider
    if (prevName == null) delete process.env.RAILWAY_ENVIRONMENT_NAME
    else process.env.RAILWAY_ENVIRONMENT_NAME = prevName
  }
})

test('mock payment blocked on production runtime', () => {
  const prevProvider = process.env.INSURANCE_BILLING_PROVIDER
  const prevName = process.env.RAILWAY_ENVIRONMENT_NAME
  process.env.INSURANCE_BILLING_PROVIDER = 'mock'
  process.env.RAILWAY_ENVIRONMENT_NAME = 'production'
  try {
    assert.equal(isMockPaymentAllowed(), false)
  } finally {
    if (prevProvider == null) delete process.env.INSURANCE_BILLING_PROVIDER
    else process.env.INSURANCE_BILLING_PROVIDER = prevProvider
    if (prevName == null) delete process.env.RAILWAY_ENVIRONMENT_NAME
    else process.env.RAILWAY_ENVIRONMENT_NAME = prevName
  }
})
