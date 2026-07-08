export type SmsScheduleType = 'once' | 'daily' | 'weekly' | 'monthly'

export type SmsScheduledRuleStatus = 'active' | 'inactive' | 'paused' | 'failed'

export type SmsScheduledListFilter = 'all' | 'active' | 'inactive' | 'failed'

export type SmsScheduledMobilePanel = 'list' | 'settings' | 'preview' | 'history'

/** 서버 저장 예약 규칙 (GET /api/sms/scheduled) */
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
  serverStatus?: 'active' | 'paused' | 'processing' | 'completed' | 'failed' | 'deleted'
  lastErrorCode?: string | null
  lastErrorMessage?: string | null
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
