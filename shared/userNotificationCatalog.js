import { CUSTOMER_ALERT_DATE_LABEL } from './customerAlertDateCopy.js'

/**
 * 알림 type 값의 단일 출처.
 * 서버 허용 목록, 미확인 조회, 알림 센터 섹션, 배지 문구, 중복 키가 이 목록을 읽는다.
 * 화면마다 type 문자열을 다시 적지 않는다.
 */
export const USER_NOTIFICATION_TYPES = {
  CAR_EXPIRY: 'car_expiry',
  INSURANCE_AGE_DATE: 'insurance_age_date',
  CLAIM_REQUEST_RECEIVED: 'claim_request_received',
  SPECIAL_DATE: 'special_date',
  CUSTOMER_CREATED: 'customer_created',
  NEWSLETTER_PUBLISHED: 'newsletter_published',
  ADVISOR_CONSULTATION_LEAD: 'advisor_consultation_lead',
}

export const USER_NOTIFICATION_TYPE_LABELS = {
  [USER_NOTIFICATION_TYPES.CAR_EXPIRY]: '자동차 만기',
  [USER_NOTIFICATION_TYPES.INSURANCE_AGE_DATE]: '상령일',
  [USER_NOTIFICATION_TYPES.CLAIM_REQUEST_RECEIVED]: '청구알림',
  [USER_NOTIFICATION_TYPES.SPECIAL_DATE]: CUSTOMER_ALERT_DATE_LABEL,
  [USER_NOTIFICATION_TYPES.CUSTOMER_CREATED]: '신규 고객',
  [USER_NOTIFICATION_TYPES.NEWSLETTER_PUBLISHED]: '소식지',
  [USER_NOTIFICATION_TYPES.ADVISOR_CONSULTATION_LEAD]: '상담 신청',
}

/**
 * 알림 센터(/notifications)와 종 미읽음 수에 올라오는 타입.
 * 순서 = 화면 섹션 순서.
 *
 * activeRule
 * - window: 설정 일수 안의 target_date 만
 * - toggle: 설정이 켜져 있으면 날짜 창 없이
 * - always: 해제 전까지 항상 (날짜 창 없음)
 *
 * dedupe
 * - legacy: 기존 customer/target/claim 식별. reference_id 는 키에 넣지 않는다.
 * - reference: legacy 키에 더해 reference_id 로 구분한다. 상담 리드 A/B 가 한 줄로 합쳐지지 않게 한다.
 *
 * referenceDate created_at: target_date 가 없을 때 생성일을 기준일로 쓴다.
 * primaryText message: customer_name 이 비어 있으므로 저장된 message 를 행 문구로 쓴다.
 */
export const USER_NOTIFICATION_CENTER_SECTIONS = [
  {
    type: USER_NOTIFICATION_TYPES.INSURANCE_AGE_DATE,
    title: '상령일',
    badgeLabel: '상령일',
    dateColumnLabel: '상령일',
    sectionClass: 'age',
    activeRule: 'window',
    settingKey: 'insuranceAge',
    dedupe: 'legacy',
    primaryText: 'customer_name',
    referenceDate: 'target_date',
    navigate: 'customer',
  },
  {
    type: USER_NOTIFICATION_TYPES.CAR_EXPIRY,
    title: '자동차만기',
    badgeLabel: '자동차 만기',
    dateColumnLabel: '만기일',
    sectionClass: 'car',
    activeRule: 'window',
    settingKey: 'carExpiry',
    dedupe: 'legacy',
    primaryText: 'customer_name',
    referenceDate: 'target_date',
    navigate: 'customer',
  },
  {
    type: USER_NOTIFICATION_TYPES.SPECIAL_DATE,
    title: '지정일',
    badgeLabel: '지정일',
    dateColumnLabel: '지정일',
    sectionClass: 'special',
    activeRule: 'window',
    settingKey: 'specialDate',
    dedupe: 'legacy',
    primaryText: 'customer_name',
    referenceDate: 'target_date',
    navigate: 'customer',
  },
  {
    type: USER_NOTIFICATION_TYPES.CLAIM_REQUEST_RECEIVED,
    title: '새로운 보험 청구',
    badgeLabel: '청구알림',
    dateColumnLabel: '접수일',
    sectionClass: 'claim',
    activeRule: 'toggle',
    settingKey: 'claimRequest',
    dedupe: 'legacy',
    primaryText: 'customer_name',
    referenceDate: 'created_at',
    navigate: 'customer',
  },
  {
    type: USER_NOTIFICATION_TYPES.ADVISOR_CONSULTATION_LEAD,
    title: '상담 신청',
    badgeLabel: '상담 신청',
    dateColumnLabel: '신청일',
    sectionClass: 'consultation',
    activeRule: 'always',
    settingKey: null,
    dedupe: 'reference',
    primaryText: 'message',
    referenceDate: 'created_at',
    navigate: 'consultation_lead',
  },
]

const TYPE_TOKEN = /^[a-z0-9_]+$/

function findCenterSection(type) {
  return USER_NOTIFICATION_CENTER_SECTIONS.find((section) => section.type === type) ?? null
}

export function assertNotificationTypeToken(type) {
  const value = String(type ?? '')
  if (!TYPE_TOKEN.test(value)) {
    throw new Error(`Invalid notification type token: ${type}`)
  }
  return value
}

export function notificationBadgeLabel(type) {
  return findCenterSection(type)?.badgeLabel ?? ''
}

export function notificationNavigateKind(type) {
  const kind = findCenterSection(type)?.navigate
  return kind === 'consultation_lead' ? 'consultation_lead' : 'customer'
}

export function notificationUsesCreatedAtReference(type) {
  return findCenterSection(type)?.referenceDate === 'created_at'
}

export function notificationReferenceDedupePart(row) {
  const section = findCenterSection(row?.type)
  if (section?.dedupe !== 'reference') {
    return ''
  }
  const reference = row?.reference_id ?? row?.referenceId
  return reference == null ? '' : String(reference)
}

export function buildAdvisorConsultationLeadNotificationMessage(visitorName) {
  const name = String(visitorName ?? '').trim()
  if (!name) {
    return '상담 신청이 도착했습니다.'
  }
  return `${name}님의 상담 신청이 도착했습니다.`
}

/**
 * 알림 행의 첫 칸 문구.
 * 상담 신청은 customer_name 이 비어 있으므로 저장된 message 를 보여 준다.
 * message 가 없으면 신청 시점과 같은 문장으로 폴백한다.
 */
export function formatNotificationPrimaryText(row) {
  const section = findCenterSection(row?.type)
  if (section?.primaryText === 'message') {
    const message = String(row?.message ?? '').trim()
    if (message) {
      return message
    }
    return buildAdvisorConsultationLeadNotificationMessage(row?.visitorName ?? row?.visitor_name)
  }
  const name = String(row?.customerName ?? row?.customer_name ?? '').trim()
  return name || '—'
}
