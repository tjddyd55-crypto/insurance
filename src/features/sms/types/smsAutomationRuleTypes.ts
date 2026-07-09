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
  excludeMinors: boolean
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
  excludeMinors: boolean
}

export type SmsAutomationPreviewItem = {
  customerId: number
  customerName: string
  phone: string
  triggerLabel: string
  referenceTitle: string | null
  referenceDate: string | null
  referenceType?: string | null
  referenceId?: number | null
  triggerInstanceKey?: string | null
  dayOffset: number
  messageBody: string
  sendable: boolean
  excludedReason: string | null
  scopeNote?: string | null
  carNumber?: string | null
}

export type SmsAutomationRunSummary = {
  total: number
  sendable: number
  excluded: number
  sent: number
  simulated: number
  failed: number
  skippedDuplicate: number
}

export type SmsAutomationRunResult = {
  runId: number
  mode: 'DRY_RUN' | 'REAL_SEND' | 'SIMULATED_SEND'
  runType: 'MANUAL' | 'SCHEDULED'
  realSendEnabled: boolean
  summary: SmsAutomationRunSummary
}

export type SmsAutomationRunItem = {
  id: number
  runId: number
  customerId: number | null
  customerName: string
  phone: string
  referenceTitle: string | null
  referenceDate: string | null
  messageBody: string
  sendable: boolean
  excludedReason: string | null
  sendStatus: 'EXCLUDED' | 'SKIPPED_DUPLICATE' | 'SIMULATED' | 'SENT' | 'FAILED'
  sendResultMessage: string | null
}

export type SmsAutomationRunDetail = {
  run: {
    id: number
    runType: string
    runMode: string
    status: string
    baseDate: string
    targetDate: string
    totalCount: number
    sendableCount: number
    excludedCount: number
    successCount: number
    failedCount: number
    skippedDuplicateCount: number
    createdAt: string
  }
  items: SmsAutomationRunItem[]
}

export type SmsAutomationRulePreview = {
  rule: {
    id: number
    ruleName: string
    triggerType: SmsAutomationTriggerType
    dayOffset: number
    sendTime: string
    isActive: boolean
    excludeMinors: boolean
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
