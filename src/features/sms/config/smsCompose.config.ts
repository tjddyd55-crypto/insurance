/** EUC-KR 근사 byte 기준 — server/sms/smsMessageUtils.js 와 동일 */
export const SMS_BYTE_LIMIT = 90
/** @deprecated use SMS_BYTE_LIMIT */
export const SMS_BYTE_LIMIT_SMS = SMS_BYTE_LIMIT

/** PC composer 고정폭 (px) — editor 620 + gap 24 + preview 360 */
export const SMS_COMPOSER_PC_EDITOR_WIDTH = 620
export const SMS_COMPOSER_PC_PREVIEW_WIDTH = 360
export const SMS_COMPOSER_PC_COLUMN_GAP = 24
export const SMS_COMPOSER_PC_MAX_WIDTH =
  SMS_COMPOSER_PC_EDITOR_WIDTH + SMS_COMPOSER_PC_COLUMN_GAP + SMS_COMPOSER_PC_PREVIEW_WIDTH

/** 휴대폰 미리보기 프레임 (px) — 알리고 줄바꿈 예측 기준 */
export const SMS_PHONE_PREVIEW_WIDTH = SMS_COMPOSER_PC_PREVIEW_WIDTH
export const SMS_PHONE_SCREEN_WIDTH = 300
export const SMS_PHONE_SCREEN_MIN_HEIGHT = 540
export const SMS_PHONE_OUTER_MIN_HEIGHT = 640
/** screen 좌우 padding 합산 후 본문 렌더 폭 (300 - 12*2) */
export const SMS_PHONE_TEXT_AREA_WIDTH = 276
export const SMS_PHONE_TEXT_WIDTH = SMS_PHONE_TEXT_AREA_WIDTH
export const SMS_PHONE_TEXT_PADDING_X = 12
export const SMS_PHONE_TEXT_PADDING_Y = 14
/** @deprecated use SMS_PHONE_TEXT_AREA_WIDTH */
export const SMS_PHONE_BUBBLE_MAX_WIDTH = SMS_PHONE_TEXT_AREA_WIDTH

/**
 * 명시적 "샘플 미리보기" 토글에서만 사용.
 * 고객 미선택 상태에서는 자동 치환에 쓰이지 않는다.
 */
export const SMS_EXPLICIT_SAMPLE_VALUES = {
  customerName: '홍길동',
  agentName: '박성용',
  agentPhone: '010-2222-1382',
  companyName: 'ONE FC',
  senderName: '박성용',
  claimLink: 'https://example.com/claim/sample',
  reservationDate: '2026-06-30',
  referenceDate: '2026-06-30',
  dDayLabel: '당일',
  memo: '메모 샘플',
} as const

/** 광고 표시명 미설정 시 미리보기 placeholder */
export const SMS_AD_DISPLAY_NAME_PLACEHOLDER = '{광고 표시명}'

/** 광고성 미리보기용 무료수신거부 번호 */
export const SMS_AD_OPT_OUT_NUMBER = '0808811258'

/** provider MMS 미지원 — UI만 disabled */
export const SMS_MMS_ATTACHMENT_UI_ENABLED = false

export const SMS_TRANSPORT_TYPE_LABELS = {
  SMS: '단문(SMS)',
  LMS: '장문(LMS)',
  MMS: '그림(MMS)',
} as const

export const SMS_DEDUCTION_LABELS = {
  SMS: '단문(SMS) 1건',
  LMS: '장문(LMS) 1건',
  MMS: '그림(MMS) 1건',
} as const
