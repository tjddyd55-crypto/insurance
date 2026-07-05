import { describe, expect, it } from 'vitest'
import { formatSmsTemplateMetaLine, formatSmsTemplateTransportLabel } from './smsTemplateDisplay'

describe('smsTemplateDisplay', () => {
  it('detects SMS transport', () => {
    expect(formatSmsTemplateTransportLabel('짧은 문자')).toBe('SMS')
  })

  it('detects LMS transport', () => {
    expect(formatSmsTemplateTransportLabel('a'.repeat(91))).toBe('LMS')
  })

  it('formats meta line', () => {
    expect(formatSmsTemplateMetaLine({ id: 1, title: 't', message: 'hello', messageType: 'info' })).toBe(
      'SMS · 5byte',
    )
  })
})
