import { USER_NOTIFICATION_CENTER_SECTIONS } from '@insurance-shared/userNotificationCatalog.js'
import type { NotificationListType, UserAlertSettings } from '../api/notificationApi'

export type NotificationSectionConfig = {
  type: Exclude<NotificationListType, 'all'>
  title: string
  dateColumnLabel: string
  sectionClass: 'age' | 'car' | 'claim' | 'special' | 'consultation'
}

const SECTION_CLASSES = ['age', 'car', 'claim', 'special', 'consultation'] as const

function isSectionClass(value: string): value is NotificationSectionConfig['sectionClass'] {
  return SECTION_CLASSES.some((item) => item === value)
}

const CENTER_NOTIFICATION_TYPES: Record<Exclude<NotificationListType, 'all'>, true> = {
  insurance_age_date: true,
  car_expiry: true,
  special_date: true,
  claim_request_received: true,
  advisor_consultation_lead: true,
}

function isCenterNotificationType(value: string): value is Exclude<NotificationListType, 'all'> {
  return Object.prototype.hasOwnProperty.call(CENTER_NOTIFICATION_TYPES, value)
}

export const NOTIFICATION_SECTIONS: NotificationSectionConfig[] = USER_NOTIFICATION_CENTER_SECTIONS.map(
  (section) => {
    if (!isCenterNotificationType(section.type) || !isSectionClass(section.sectionClass)) {
      throw new Error(`알림 센터 섹션 설정이 올바르지 않습니다: ${section.type}`)
    }
    return {
      type: section.type,
      title: section.title,
      dateColumnLabel: section.dateColumnLabel,
      sectionClass: section.sectionClass,
    }
  },
)

/** 패널 접힘 상태 기본 표시 행 수 */
export const NOTIFICATION_PANEL_PREVIEW_COUNT = 5

export const DEFAULT_USER_ALERT_SETTINGS: UserAlertSettings = {
  insuranceAge: { enabled: true, daysBefore: 30 },
  carExpiry: { enabled: true, daysBefore: 30 },
  specialDate: { enabled: true, daysBefore: 30 },
  claimRequest: { enabled: true },
}
