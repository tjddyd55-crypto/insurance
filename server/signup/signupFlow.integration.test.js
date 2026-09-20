import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { isSignupAutoPromotionEnabled } from './freeLaunchPolicy.js'

describe('signup flow integration policy', () => {
  it('registerAuthApi does not invoke applySignupAutoPromotionOnSignup', () => {
    const source = readFileSync(new URL('../auth/registerAuthApi.js', import.meta.url), 'utf8')
    assert.doesNotMatch(source, /applySignupAutoPromotionOnSignup/)
  })

  it('signup auto promotion requires explicit SIGNUP_AUTO_PROMOTION_ENABLED', () => {
    const prevCode = process.env.SIGNUP_AUTO_PROMOTION_CODE
    const prevEnabled = process.env.SIGNUP_AUTO_PROMOTION_ENABLED
    try {
      process.env.SIGNUP_AUTO_PROMOTION_CODE = 'SYA6KABE'
      delete process.env.SIGNUP_AUTO_PROMOTION_ENABLED
      assert.equal(isSignupAutoPromotionEnabled(), false)
    } finally {
      if (prevCode === undefined) delete process.env.SIGNUP_AUTO_PROMOTION_CODE
      else process.env.SIGNUP_AUTO_PROMOTION_CODE = prevCode
      if (prevEnabled === undefined) delete process.env.SIGNUP_AUTO_PROMOTION_ENABLED
      else process.env.SIGNUP_AUTO_PROMOTION_ENABLED = prevEnabled
    }
  })
})
