import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildCustomerAppLinkButtonPayload,
  buildCustomerAppLinkMessage,
  CUSTOMER_APP_LINK_TPL_CODE,
  getCustomerAppLinkTemplate,
  isPlaceholderTplCode,
} from './alimtalkTemplates.js'

describe('alimtalkTemplates', () => {
  it('defaults tplCode to UJ_6184', () => {
    assert.equal(CUSTOMER_APP_LINK_TPL_CODE, 'UJ_6184')
    const tpl = getCustomerAppLinkTemplate({})
    assert.equal(tpl.tplCode, 'UJ_6184')
    assert.equal(tpl.isPlaceholder, false)
    assert.equal(tpl.subject, '고객앱 안내')
    assert.equal(tpl.templateName, '고객앱 접속 링크 안내')
    assert.equal(tpl.channelName, '@crm솔루션')
    assert.equal(tpl.failover, 'N')
  })

  it('builds approved-style message with customer/manager names', () => {
    const msg = buildCustomerAppLinkMessage({ customerName: '김철수', managerName: '박담당' })
    assert.equal(
      msg,
      [
        '김철수님, 안녕하세요.',
        '박담당입니다.',
        '',
        '요청하신 보험 업무 확인 및 자료 첨부를 위해 고객앱 접속 링크를 안내드립니다.',
        '아래 [고객앱 열기] 버튼을 눌러 내용을 확인해 주세요.',
        '',
        '※ 본 링크는 고객님의 보험 업무 확인 및 자료 제출을 위한 안내입니다.',
      ].join('\n'),
    )
  })

  it('puts https customerAppUrl into button even when http given', () => {
    const payload = buildCustomerAppLinkButtonPayload({
      customerAppUrl: 'http://example.com/customer-app/link?code=ABC',
    })
    assert.equal(payload.button[0].linkType, 'WL')
    assert.equal(payload.button[0].name, '고객앱 열기')
    assert.equal(payload.button[0].linkMo, 'https://example.com/customer-app/link?code=ABC')
    assert.equal(payload.button[0].linkPc, 'https://example.com/customer-app/link?code=ABC')
  })

  it('treats empty and PLACEHOLDER as placeholder tpl', () => {
    assert.equal(isPlaceholderTplCode(''), true)
    assert.equal(isPlaceholderTplCode('PLACEHOLDER'), true)
    assert.equal(isPlaceholderTplCode('UJ_6184'), false)
  })
})
