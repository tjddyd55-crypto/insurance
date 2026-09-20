import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isFreeLaunchGrantMode,
  isSignupAutoPromotionEnabled,
  getSignupAutoPromotionCode,
} from './freeLaunchPolicy.js'

describe('freeLaunchPolicy', () => {
  it('signup auto promotion requires explicit SIGNUP_AUTO_PROMOTION_ENABLED', () => {
    const prevCode = process.env.SIGNUP_AUTO_PROMOTION_CODE
    const prevEnabled = process.env.SIGNUP_AUTO_PROMOTION_ENABLED
    try {
      process.env.SIGNUP_AUTO_PROMOTION_CODE = 'TESTCODE'
      delete process.env.SIGNUP_AUTO_PROMOTION_ENABLED
      assert.equal(isSignupAutoPromotionEnabled(), false)
      process.env.SIGNUP_AUTO_PROMOTION_ENABLED = 'true'
      assert.equal(isSignupAutoPromotionEnabled(), true)
      assert.equal(getSignupAutoPromotionCode(), 'TESTCODE')
    } finally {
      if (prevCode === undefined) {
        delete process.env.SIGNUP_AUTO_PROMOTION_CODE
      } else {
        process.env.SIGNUP_AUTO_PROMOTION_CODE = prevCode
      }
      if (prevEnabled === undefined) {
        delete process.env.SIGNUP_AUTO_PROMOTION_ENABLED
      } else {
        process.env.SIGNUP_AUTO_PROMOTION_ENABLED = prevEnabled
      }
    }
  })

  it('free launch grant mode requires FREE_LAUNCH_GRANT_MODE=true', () => {
    const prev = process.env.FREE_LAUNCH_GRANT_MODE
    try {
      delete process.env.FREE_LAUNCH_GRANT_MODE
      assert.equal(isFreeLaunchGrantMode(), false)
      process.env.FREE_LAUNCH_GRANT_MODE = 'true'
      assert.equal(isFreeLaunchGrantMode(), true)
    } finally {
      if (prev === undefined) {
        delete process.env.FREE_LAUNCH_GRANT_MODE
      } else {
        process.env.FREE_LAUNCH_GRANT_MODE = prev
      }
    }
  })
})
