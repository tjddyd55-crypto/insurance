import { describe, expect, it } from 'vitest'
import {
  buildAutomationPhonePreviewMessage,
  buildAutomationPreviewSampleValues,
  renderAutomationPreviewMessage,
  SMS_AUTOMATION_PREVIEW_SAMPLE_PHONE,
} from './smsAutomationPreviewMessage'
import type { SmsAutomationRulePreview } from '../types/smsAutomationRuleTypes'

describe('smsAutomationPreviewMessage', () => {
  it('buildAutomationPreviewSampleValues includes trigger-specific fields', () => {
    const values = buildAutomationPreviewSampleValues('CAR_INSURANCE_EXPIRY', {
      dayOffset: 7,
      baseDate: '2026-07-09',
    })
    expect(values.고객명).toBe('홍길동')
    expect(values.만기일).toBe('2026-08-08')
    expect(values.D일).toBe('D-7')
  })

  it('renderAutomationPreviewMessage substitutes known variables', () => {
    const rendered = renderAutomationPreviewMessage(
      '{고객명}님 생일을 축하드립니다. {담당자명}',
      buildAutomationPreviewSampleValues('BIRTHDAY'),
    )
    expect(rendered).toBe('홍길동님 생일을 축하드립니다. 김담당')
  })

  it('renderAutomationPreviewMessage leaves unknown variables intact', () => {
    const rendered = renderAutomationPreviewMessage('{알수없음}', { 고객명: '홍길동' })
    expect(rendered).toBe('{알수없음}')
  })

  it('buildAutomationPhonePreviewMessage prefers first sendable dry-run item', () => {
    const preview = {
      baseDate: '2026-07-09',
      items: [
        {
          customerId: 1,
          customerName: '김철수',
          phone: '01099998888',
          messageBody: '김철수님 안내',
          sendable: false,
          excludedReason: '문자 수신거부',
          triggerLabel: '생일',
          referenceTitle: null,
          referenceDate: null,
          dayOffset: 0,
        },
        {
          customerId: 2,
          customerName: '이영희',
          phone: '01011112222',
          messageBody: '이영희님 안내',
          sendable: true,
          excludedReason: null,
          triggerLabel: '생일',
          referenceTitle: null,
          referenceDate: null,
          dayOffset: 0,
        },
      ],
    } as SmsAutomationRulePreview

    const result = buildAutomationPhonePreviewMessage({
      messageBody: '{고객명}님',
      triggerType: 'BIRTHDAY',
      dayOffset: 0,
      preview,
    })

    expect(result.message).toBe('이영희님 안내')
    expect(result.phone).toBe('01011112222')
  })

  it('buildAutomationPhonePreviewMessage falls back to sample values without dry-run', () => {
    const result = buildAutomationPhonePreviewMessage({
      messageBody: '{고객명}님 {만기일} 만기',
      triggerType: 'CAR_INSURANCE_EXPIRY',
      dayOffset: 7,
      baseDate: '2026-07-09',
      preview: null,
    })

    expect(result.message).toBe('홍길동님 2026-08-08 만기')
    expect(result.phone).toBe(SMS_AUTOMATION_PREVIEW_SAMPLE_PHONE)
  })
})
