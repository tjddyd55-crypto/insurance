import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildCustomerAppLinkButtonPayload,
  buildCustomerAppLinkMessage,
  getCustomerAppLinkTemplate,
  isPlaceholderTplCode,
} from './alimtalkTemplates.js'

describe('alimtalkTemplates', () => {
  it('builds message with customer/manager names', () => {
    const msg = buildCustomerAppLinkMessage({ customerName: '김철수', managerName: '박담당' })
    assert.match(msg, /김철수님/)
    assert.match(msg, /담당자: 박담당/)
  })

  it('puts customerAppUrl into button_1 linkMo/linkPc', () => {
    const payload = buildCustomerAppLinkButtonPayload({
      customerAppUrl: 'https://example.com/customer-app/link?code=ABC',
    })
    assert.equal(payload.button[0].linkType, 'WL')
    assert.equal(payload.button[0].name, '고객앱 열기')
    assert.equal(payload.button[0].linkMo, 'https://example.com/customer-app/link?code=ABC')
    assert.equal(payload.button[0].linkPc, 'https://example.com/customer-app/link?code=ABC')
  })

  it('treats empty and PLACEHOLDER as placeholder tpl', () => {
    assert.equal(isPlaceholderTplCode(''), true)
    assert.equal(isPlaceholderTplCode('PLACEHOLDER'), true)
    assert.equal(isPlaceholderTplCode('UJ_9999'), false)
    const tpl = getCustomerAppLinkTemplate({})
    assert.equal(tpl.isPlaceholder, true)
    assert.equal(tpl.subject, '고객앱 안내')
  })
})
