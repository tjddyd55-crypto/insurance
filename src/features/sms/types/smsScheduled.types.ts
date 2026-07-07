export type SmsScheduleType = 'once' | 'daily' | 'weekly' | 'monthly'

export type SmsScheduledRuleStatus = 'active' | 'inactive' | 'paused' | 'failed'

export type SmsScheduledListFilter = 'all' | 'active' | 'inactive' | 'failed'

export type SmsScheduledMobilePanel = 'list' | 'settings' | 'preview' | 'history'

/** UI 저장용 예약 규칙. 반복 규칙은 localStorage, 1회는 추후 campaigns API 연동 가능. */
export type SmsScheduledRule = {
  id: string
  name: string
  description?: string
  enabled: boolean
  scheduleType: SmsScheduleType
  sendDate?: string
  sendTime: string
  weekdays?: number[]
  monthDay?: number
  recipientGroupId: string
  templateId?: string
  messageBody: string
  messageType: 'info' | 'ad'
  nextRunAt?: string | null
  lastRunAt?: string | null
  status: SmsScheduledRuleStatus
  createdAt: string
  updatedAt: string
}

export type SmsScheduledFormState = {
  name: string
  description: string
  enabled: boolean
  scheduleType: SmsScheduleType
  sendDate: string
  sendTime: string
  weekdays: number[]
  monthDay: number
  recipientGroupId: string
  templateId: string
  messageBody: string
  messageType: 'info' | 'ad'
}

export type SmsScheduledRunHistoryItem = {
  id: string
  ranAt: string
  targetCount: number
  successCount: number
  failCount: number
  skippedCount: number
  status: 'completed' | 'failed' | 'skipped'
}

export const EMPTY_SMS_SCHEDULED_FORM: SmsScheduledFormState = {
  name: '',
  description: '',
  enabled: true,
  scheduleType: 'once',
  sendDate: '',
  sendTime: '09:00',
  weekdays: [],
  monthDay: 10,
  recipientGroupId: '',
  templateId: '',
  messageBody: '',
  messageType: 'info',
}
