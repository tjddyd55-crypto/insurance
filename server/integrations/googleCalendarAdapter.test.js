import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { accessTokenFromStoredSecret } from './googleCalendarAdapter.js'

describe('google calendar credential parse', () => {
  it('평문 토큰과 JSON 토큰만 읽고 빈 값은 버린다', () => {
    assert.equal(accessTokenFromStoredSecret('ya29.token'), 'ya29.token')
    assert.equal(accessTokenFromStoredSecret('{"accessToken":"abc"}'), 'abc')
    assert.equal(accessTokenFromStoredSecret('{"access_token":"def"}'), 'def')
    assert.equal(accessTokenFromStoredSecret(''), '')
  })
})
