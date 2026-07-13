import { describe, expect, it } from 'vitest'
import { SMS_RESERVATION_VARIABLE_OPTIONS } from '../config/smsVariables.config'
import { SMS_ENABLED_TEMPLATE_VARIABLES, applySmsTemplateVariables } from './smsTemplateVariables'

describe('SMS_RESERVATION_VARIABLE_OPTIONS', () => {
  it('exposes five common reservation variables', () => {
    expect(SMS_RESERVATION_VARIABLE_OPTIONS).toHaveLength(5)
    expect(SMS_RESERVATION_VARIABLE_OPTIONS.map((item) => item.label)).toEqual([
      '고객명',
      '담당자명',
      '담당자연락처',
      '기준일',
      'D일',
    ])
  })
})

describe('SMS_ENABLED_TEMPLATE_VARIABLES', () => {
  it('matches reservation variable options', () => {
    expect(SMS_ENABLED_TEMPLATE_VARIABLES).toHaveLength(5)
    expect(SMS_ENABLED_TEMPLATE_VARIABLES.every((item) => item.enabled)).toBe(true)
  })
})

describe('applySmsTemplateVariables reservation tokens', () => {
  it('substitutes common reservation variables in explicit sample mode', () => {
    const result = applySmsTemplateVariables('{고객명}님 {담당자명} {기준일} {D일}', {
      mode: 'explicitSample',
      values: {
        customerName: '홍길동',
        agentName: '박성용',
        agentPhone: '010-2222-1382',
        referenceDate: '2026-07-13',
        dDayLabel: '당일',
      },
    })
    expect(result.text).toBe('홍길동님 박성용 2026-07-13 당일')
    expect(result.variablesSubstituted).toBe(true)
  })
})
