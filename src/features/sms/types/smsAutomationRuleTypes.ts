export const SMS_AUTOMATION_TRIGGER_TYPES = [
  'BIRTHDAY',
  'CAR_INSURANCE_EXPIRY',
  'INSURANCE_AGE',
  'CUSTOMER_SPECIAL_DATE',
] as const

export type SmsAutomationTriggerType = (typeof SMS_AUTOMATION_TRIGGER_TYPES)[number]

export const SMS_AUTOMATION_SPECIAL_DATE_PURPOSE_TYPES = [
  'ALL',
  'CELEBRATION',
  'THANKS',
  'NOTICE',
  'CHECKUP',
] as const

export type SmsAutomationSpecialDatePurposeType =
  (typeof SMS_AUTOMATION_SPECIAL_DATE_PURPOSE_TYPES)[number]

export type SmsAutomationRule = {
  id: number
  ruleName: string
  triggerType: SmsAutomationTriggerType
  specialDatePurposeType: SmsAutomationSpecialDatePurposeType | null
  dayOffset: number
  sendTime: string
  messageBody: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type SmsAutomationRuleInput = {
  ruleName: string
  triggerType: SmsAutomationTriggerType
  specialDatePurposeType?: SmsAutomationSpecialDatePurposeType | null
  dayOffset: number
  sendTime: string
  messageBody: string
  isActive: boolean
}

export type SmsAutomationPreviewItem = {
  customerId: number
  customerName: string
  phone: string
  triggerLabel: string
  referenceTitle: string | null
  referenceDate: string | null
  dayOffset: number
  messageBody: string
  sendable: boolean
  excludedReason: string | null
  carNumber?: string | null
}

export type SmsAutomationRulePreview = {
  rule: {
    id: number
    ruleName: string
    triggerType: SmsAutomationTriggerType
    dayOffset: number
    sendTime: string
    isActive: boolean
  }
  baseDate: string
  targetDate: string
  summary: {
    total: number
    sendable: number
    excluded: number
  }
  items: SmsAutomationPreviewItem[]
  previewAvailable: boolean
}

export type SmsAutomationRuleFormState = SmsAutomationRuleInput & {
  id?: number
}

export type SmsAutomationRuleStats = {
  total: number
  active: number
  inactive: number
}
