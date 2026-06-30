/** EUC-KR 근사 byte 기준 — server/sms/smsMessageUtils.js 와 동일 */
export const SMS_BYTE_LIMIT = 90
/** @deprecated use SMS_BYTE_LIMIT */
export const SMS_BYTE_LIMIT_SMS = SMS_BYTE_LIMIT

export const SMS_SAMPLE_CUSTOMER_NAME = '홍길동'
export const SMS_SAMPLE_AGENT_NAME = '박성용'
export const SMS_SAMPLE_COMPANY_NAME = 'ONE FC'
export const SMS_SAMPLE_CLAIM_LINK = 'https://example.com/claim/sample'

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
