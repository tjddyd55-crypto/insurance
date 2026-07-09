import {
  formatAutomationDayOffsetLabel,
  getAutomationPreviewBaseDateDefault,
} from '../config/smsAutomationRule.config.ts'
import type {
  SmsAutomationPreviewItem,
  SmsAutomationRulePreview,
  SmsAutomationTriggerType,
} from '../types/smsAutomationRuleTypes.ts'

export const SMS_AUTOMATION_PREVIEW_SAMPLE_PHONE = '010-1234-5678'

export type AutomationPreviewVariableValues = Record<string, string>

const TRIGGER_SAMPLE_EXTENSIONS: Record<
  SmsAutomationTriggerType,
  AutomationPreviewVariableValues
> = {
  BIRTHDAY: { 생일: '1990-07-16' },
  CAR_INSURANCE_EXPIRY: {
    만기일: '2026-08-08',
    차량번호: '12가3456',
    보험회사: '삼성화재',
  },
  INSURANCE_AGE: {
    보험나이: '36',
    보험나이변경일: '2026-08-08',
  },
  CUSTOMER_SPECIAL_DATE: {
    기념일명: '결혼기념일',
    타이틀: '결혼기념일',
    기념일날짜: '2026-07-16',
  },
}

export function buildAutomationPreviewSampleValues(
  triggerType: SmsAutomationTriggerType,
  options?: { dayOffset?: number; baseDate?: string },
): AutomationPreviewVariableValues {
  const baseDate = options?.baseDate?.trim() || getAutomationPreviewBaseDateDefault()
  const dayOffset = options?.dayOffset ?? 0

  return {
    고객명: '홍길동',
    담당자명: '김담당',
    담당자연락처: SMS_AUTOMATION_PREVIEW_SAMPLE_PHONE,
    기준일: baseDate,
    D일: formatAutomationDayOffsetLabel(dayOffset),
    ...TRIGGER_SAMPLE_EXTENSIONS[triggerType],
  }
}

export function renderAutomationPreviewMessage(
  messageBody: string,
  values: AutomationPreviewVariableValues,
): string {
  let rendered = String(messageBody ?? '')
  for (const [key, value] of Object.entries(values)) {
    rendered = rendered.replaceAll(`{${key}}`, value ?? '')
  }
  return rendered
}

function pickAutomationPreviewItem(
  preview: SmsAutomationRulePreview | null | undefined,
): SmsAutomationPreviewItem | null {
  if (!preview?.items?.length) {
    return null
  }
  const sendable = preview.items.find((item) => item.sendable)
  return sendable ?? preview.items[0] ?? null
}

export function buildAutomationPhonePreviewMessage(input: {
  messageBody: string
  triggerType: SmsAutomationTriggerType
  dayOffset: number
  baseDate?: string
  preview?: SmsAutomationRulePreview | null
}): { message: string; phone: string } {
  const previewItem = pickAutomationPreviewItem(input.preview)
  if (previewItem?.messageBody?.trim()) {
    return {
      message: previewItem.messageBody,
      phone: previewItem.phone?.trim() || SMS_AUTOMATION_PREVIEW_SAMPLE_PHONE,
    }
  }

  const values = buildAutomationPreviewSampleValues(input.triggerType, {
    dayOffset: input.dayOffset,
    baseDate: input.preview?.baseDate ?? input.baseDate,
  })

  return {
    message: renderAutomationPreviewMessage(input.messageBody, values),
    phone: SMS_AUTOMATION_PREVIEW_SAMPLE_PHONE,
  }
}
