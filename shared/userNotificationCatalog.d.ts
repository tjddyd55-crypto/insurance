export const USER_NOTIFICATION_TYPES: {
  readonly CAR_EXPIRY: 'car_expiry'
  readonly INSURANCE_AGE_DATE: 'insurance_age_date'
  readonly CLAIM_REQUEST_RECEIVED: 'claim_request_received'
  readonly SPECIAL_DATE: 'special_date'
  readonly CUSTOMER_CREATED: 'customer_created'
  readonly NEWSLETTER_PUBLISHED: 'newsletter_published'
  readonly ADVISOR_CONSULTATION_LEAD: 'advisor_consultation_lead'
}

export const USER_NOTIFICATION_TYPE_LABELS: Record<string, string>

export type UserNotificationCenterSection = {
  type: string
  title: string
  badgeLabel: string
  dateColumnLabel: string
  sectionClass: string
  activeRule: 'window' | 'toggle' | 'always'
  settingKey: string | null
  dedupe: 'legacy' | 'reference'
  primaryText: 'customer_name' | 'message'
  referenceDate: 'target_date' | 'created_at'
  navigate: 'customer' | 'consultation_lead'
}

export const USER_NOTIFICATION_CENTER_SECTIONS: readonly UserNotificationCenterSection[]

export function assertNotificationTypeToken(type: string): string

export function notificationBadgeLabel(type: string): string

export function notificationNavigateKind(type: string): 'consultation_lead' | 'customer'

export function notificationUsesCreatedAtReference(type: string | undefined): boolean

export function notificationReferenceDedupePart(row: {
  type?: string
  reference_id?: string | null
  referenceId?: string | null
}): string

export function buildAdvisorConsultationLeadNotificationMessage(visitorName?: string | null): string

export function formatNotificationPrimaryText(row: {
  type?: string
  message?: string | null
  customerName?: string | null
  customer_name?: string | null
  visitorName?: string | null
  visitor_name?: string | null
}): string
