import type { SmsScheduleType } from '../types/smsScheduled.types'

export const SMS_SCHEDULE_TYPE_OPTIONS: Array<{ value: SmsScheduleType; label: string }> = [
  { value: 'once', label: '1회 예약' },
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'monthly', label: '매월' },
]

export const SMS_SCHEDULE_WEEKDAY_OPTIONS = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 7, label: '일' },
] as const

export const SMS_SCHEDULE_DEFAULT_SEND_TIME = '09:00'

export const SMS_SCHEDULE_MONTH_DAY_MIN = 1
export const SMS_SCHEDULE_MONTH_DAY_MAX = 31

export const SMS_SCHEDULE_TARGET_PREVIEW_LIMIT = 20

export const SMS_SCHEDULE_LIST_FILTER_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '활성' },
  { value: 'inactive', label: '비활성' },
  { value: 'failed', label: '실패' },
] as const

export const SMS_SCHEDULE_MOBILE_PANELS = [
  { id: 'list', label: '목록' },
  { id: 'settings', label: '설정' },
  { id: 'preview', label: '미리보기' },
  { id: 'history', label: '이력' },
] as const
