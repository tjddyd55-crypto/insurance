import type { NotificationListType } from '../api/notificationApi'

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
    title: '청구요청',
    dateColumnLabel: '접수일',
    sectionClass: 'claim',
  },
]
