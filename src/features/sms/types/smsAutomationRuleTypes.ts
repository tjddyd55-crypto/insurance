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

export type SmsAutomationRulePreview = {
  ruleId: number
  ruleName: string
  triggerType: SmsAutomationTriggerType
  dayOffset: number
  sendTime: string
  previewAvailable: boolean
  message: string
  estimatedTargetCount: number | null
  sampleTargets: Array<{
    customerId?: number
    customerName?: string
    phone?: string
    referenceDate?: string
  }>
}

export type SmsAutomationRuleFormState = SmsAutomationRuleInput & {
  id?: number
}
