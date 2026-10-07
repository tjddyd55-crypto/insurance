import type { NotificationListType, UserAlertSettings } from '../api/notificationApi'

export type NotificationSectionConfig = {
  type: Exclude<NotificationListType, 'all'>
  title: string
  dateColumnLabel: string
  sectionClass: 'age' | 'car' | 'claim' | 'special'
}

export const NOTIFICATION_SECTIONS: NotificationSectionConfig[] = [
  {
    type: 'insurance_age_date',
    title: '상령일',
    dateColumnLabel: '상령일',
    sectionClass: 'age',
  },
  {
    type: 'car_expiry',
    title: '자동차만기',
    dateColumnLabel: '만기일',
    sectionClass: 'car',
  },
  {
    type: 'special_date',
    title: '지정일',
    dateColumnLabel: '지정일',
    sectionClass: 'special',
  },
  {
    type: 'claim_request_received',
    title: '새로운 보험 청구',
    dateColumnLabel: '접수일',
    sectionClass: 'claim',
  },
]

/** 패널 접힘 상태 기본 표시 행 수 */
export const NOTIFICATION_PANEL_PREVIEW_COUNT = 5

export const DEFAULT_USER_ALERT_SETTINGS: UserAlertSettings = {
  insuranceAge: { enabled: true, daysBefore: 30 },
  carExpiry: { enabled: true, daysBefore: 30 },
  specialDate: { enabled: true, daysBefore: 30 },
  claimRequest: { enabled: true },
}
