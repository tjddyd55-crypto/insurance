import assert from 'node:assert/strict'
import test from 'node:test'
import {
  composeAdvertisementSmsMessage,
  estimateSmsByteLength,
  renderSmsTemplate,
  renderSmsTemplateDetailed,
  SMS_AD_OPT_OUT_NUMBER,
} from './smsMessageUtils.js'

test('renderSmsTemplate substitutes customer name', () => {
  assert.equal(renderSmsTemplate('Hi {고객명}', { customerName: '홍길동' }), 'Hi 홍길동')
})

test('renderSmsTemplateDetailed substitutes reservation common variables', () => {
  const rendered = renderSmsTemplateDetailed('{고객명}님 {담당자명} {담당자연락처} {기준일} {D일}', {
    customerName: '홍길동',
    agentName: '박성용',
    agentPhone: '01022221382',
    referenceDate: '2026-07-13',
    dDayLabel: '당일',
  })
  assert.equal(rendered.messageBody, '홍길동님 박성용 01022221382 2026-07-13 당일')
  assert.deepEqual(rendered.missingVariables, [])
})

test('renderSmsTemplateDetailed reports missing agent variables', () => {
  const rendered = renderSmsTemplateDetailed('{담당자명} {담당자연락처} 안내', {
    customerName: '홍길동',
    agentName: '',
    agentPhone: '',
    referenceDate: '2026-07-13',
    dDayLabel: '당일',
  })
  assert.deepEqual(rendered.missingVariables, ['담당자명', '담당자연락처'])
})

test('renderSmsTemplateDetailed renders each customer independently', () => {
  const template = '{고객명}님, 담당자 {담당자명}입니다.'
  const shared = {
    agentName: '홍길동',
    agentPhone: '010-1111-2222',
    referenceDate: '2026-07-13',
    dDayLabel: '당일',
  }
  const first = renderSmsTemplateDetailed(template, { customerName: '김철수', ...shared })
  const second = renderSmsTemplateDetailed(template, { customerName: '박영희', ...shared })
  assert.equal(first.messageBody, '김철수님, 담당자 홍길동입니다.')
  assert.equal(second.messageBody, '박영희님, 담당자 홍길동입니다.')
})

test('renderSmsTemplateDetailed falls back empty customer name to 고객', () => {
  const rendered = renderSmsTemplateDetailed('{고객명}님', { customerName: '' })
  assert.equal(rendered.messageBody, '고객님')
  assert.deepEqual(rendered.missingVariables, [])
})

test('renderSmsTemplateDetailed skips recipient when agent phone is missing', () => {
  const rendered = renderSmsTemplateDetailed('{고객명}님 {담당자연락처}', {
    customerName: '김철수',
    agentName: '홍길동',
    agentPhone: '',
    referenceDate: '2026-07-13',
    dDayLabel: '당일',
  })
  assert.deepEqual(rendered.missingVariables, ['담당자연락처'])
})

test('renderSmsTemplateDetailed does not mutate template across retries', () => {
  const template = '{고객명}님 테스트'
  renderSmsTemplateDetailed(template, { customerName: '김철수' })
  renderSmsTemplateDetailed(template, { customerName: '박영희' })
  assert.equal(template, '{고객명}님 테스트')
})

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
