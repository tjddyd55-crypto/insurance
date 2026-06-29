import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isFreeLaunchGrantMode, getSignupAutoPromotionCode } from './freeLaunchPolicy.js'

describe('freeLaunchPolicy', () => {
  it('grant mode follows SIGNUP_AUTO_PROMOTION_CODE env', () => {
    const prev = process.env.SIGNUP_AUTO_PROMOTION_CODE
    try {
      delete process.env.SIGNUP_AUTO_PROMOTION_CODE
      assert.equal(isFreeLaunchGrantMode(), false)
      process.env.SIGNUP_AUTO_PROMOTION_CODE = 'TESTCODE'
      assert.equal(isFreeLaunchGrantMode(), true)
      assert.equal(getSignupAutoPromotionCode(), 'TESTCODE')
    } finally {
      if (prev === undefined) {
        delete process.env.SIGNUP_AUTO_PROMOTION_CODE
      } else {
        process.env.SIGNUP_AUTO_PROMOTION_CODE = prev
      }
    }
  })
})
