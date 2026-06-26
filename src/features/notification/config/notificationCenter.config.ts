import type { NotificationListType } from '../api/notificationApi'

export type NotificationSectionConfig = {
  type: NotificationListType
  title: string
  dateColumnLabel: string
  sectionClass: 'age' | 'car' | 'claim'
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
    type: 'claim_request_received',
    title: '청구요청',
    dateColumnLabel: '접수일',
    sectionClass: 'claim',
  },
]
