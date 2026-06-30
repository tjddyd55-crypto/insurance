import assert from 'node:assert/strict'
import test from 'node:test'
import {
  composeAdvertisementSmsMessage,
  estimateSmsByteLength,
  SMS_AD_OPT_OUT_NUMBER,
} from './smsMessageUtils.js'

test('composeAdvertisementSmsMessage builds header body and opt-out footer', () => {
  const result = composeAdvertisementSmsMessage({
    body: '안녕하세요.',
    adDisplayName: '박성용',
  })
  assert.equal(result.ok, true)
  assert.equal(result.header, '(광고)박성용')
  assert.equal(result.footer, `무료거부 ${SMS_AD_OPT_OUT_NUMBER}`)
  assert.equal(result.message, `(광고)박성용\n안녕하세요.\n무료거부 ${SMS_AD_OPT_OUT_NUMBER}`)
})

test('composeAdvertisementSmsMessage rejects missing ad display name', () => {
  const result = composeAdvertisementSmsMessage({
    body: '안녕하세요.',
    adDisplayName: '',
  })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'sms_ad_display_name_required')
  assert.match(result.publicMessage, /광고 표시명/)
})

test('composeAdvertisementSmsMessage does not default to ONE FC', () => {
  const result = composeAdvertisementSmsMessage({
    body: '안녕하세요.',
    adDisplayName: null,
  })
  assert.equal(result.ok, false)
  assert.doesNotMatch(String(result.message ?? ''), /ONE FC/)
})

test('estimateSmsByteLength includes ad header and opt-out in composed message', () => {
  const composed = composeAdvertisementSmsMessage({
    body: '안녕하세요.',
    adDisplayName: '박성용',
  })
  assert.equal(composed.ok, true)
  const bytes = estimateSmsByteLength(composed.message)
  assert.ok(bytes > estimateSmsByteLength('안녕하세요.'))
  assert.ok(composed.message.includes(`무료거부 ${SMS_AD_OPT_OUT_NUMBER}`))
})
