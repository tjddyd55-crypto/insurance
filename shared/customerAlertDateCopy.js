/**
 * 고객이 직접 등록하는 날짜의 화면 문구.
 *
 * 데이터는 `customer_special_dates` 이고, 알림 대시보드 카드 type 은 `special_date` 이다.
 * 화면에서는 그 카드를 「알림일」이라고 부른다.
 * 상령일·자동차만기·청구요청과는 다른 알림이다.
 * API 경로·컬럼명·type 값(`special_date`)은 바꾸지 않는다.
 */
export const CUSTOMER_ALERT_DATE_LABEL = '알림일'

/** 알림 설정의 알림일 리드타임이 실제로 적용되는 대상. */
export const CUSTOMER_ALERT_DATE_SETTINGS_HINT =
  '고객 관리에 등록한 알림일만 적용됩니다. 상령일, 자동차 만기, 청구요청은 각각 따로 설정합니다.'

export const INSURANCE_AGE_NOTIFICATION_SETTINGS_HINT =
  '주민번호로 계산한 상령일만 적용됩니다.'

export const CAR_EXPIRY_NOTIFICATION_SETTINGS_HINT =
  '등록된 자동차보험 만기일만 적용됩니다.'
