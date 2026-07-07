import { inferGenderFromResidentNumberDigits } from './inferGenderFromResidentNumberDigits'

export const CUSTOMER_MEDICAL_QUESTION_TEXT =
  '5년안에 병원에서 진단이나 입원, 수술, 치료 또는 약복용중이신거 있으신가요?'

export const CUSTOMER_MEDICAL_QUESTION_HINT =
  '(몇년몇월/진단명/치료부위/수술명/입원 및 통원여부/원인/현상태)'

/** 등록·수정 폼 병력 textarea placeholder */
export const CUSTOMER_MEDICAL_TREATMENT_LABEL = '수술/치료 관련'
export const CUSTOMER_MEDICAL_MEDICATION_LABEL = '약복용 관련'
export const CUSTOMER_MEDICAL_TREATMENT_PLACEHOLDER =
  '예: 24.03 위내시경 / 용종 제거 / 2일 입원 / 현재 치료 종료'
export const CUSTOMER_MEDICAL_MEDICATION_PLACEHOLDER =
  '예: 혈압약 복용중 / 23.11부터 / 하루 1회'

/** @deprecated 단일 textarea 시절 placeholder — 신규 UI는 TREATMENT/MEDICATION 사용 */
export const CUSTOMER_MEDICAL_HISTORY_PLACEHOLDER =
  '형식 예시: 2024-03 / 진단명 / 치료부위 / 수술명 / 입원 및 통원 여부 / 원인 / 현상태'

/** 등록·수정 폼 보험가입내역 textarea placeholder */
export const CUSTOMER_INSURANCE_HISTORY_PLACEHOLDER = '보험가입내역을 입력하세요'

/** 등록·수정 폼 계좌번호 input placeholder (은행명/예금주 포함 자유 입력 허용) */
export const CUSTOMER_ACCOUNT_NUMBER_PLACEHOLDER = '계좌번호 입력 (은행명·예금주 자유 입력 가능)'

/** 카드·상세 읽기: 저장 성별 우선, 없으면 주민번호 7번째 자리, 불가면 `-` */
export function formatCustomerGenderReadLabel(
  gender: 'male' | 'female' | null | undefined,
  ssnRaw: string | null | undefined,
): string {
  if (gender === 'male') {
    return '남'
  }
  if (gender === 'female') {
    return '여'
  }
  const fromSsn = inferGenderFromResidentNumberDigits(ssnRaw)
  if (fromSsn === 'male') {
    return '남'
  }
  if (fromSsn === 'female') {
    return '여'
  }
  return '-'
}

export function formatCustomerSsnUi(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim()
  if (!text) {
    return ''
  }
  const digits = text.replace(/\D/g, '')
  if (digits.length === 13) {
    return `${digits.slice(0, 6)}-${digits.slice(6)}`
  }
  return text
}

export function formatCustomerPhoneUi(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim()
  if (!text) {
    return ''
  }
  const digits = text.replace(/\D/g, '')
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return text
}

export { formatCustomerMobileCarrierDisplay } from '../config/customerMobileCarrier.config'
