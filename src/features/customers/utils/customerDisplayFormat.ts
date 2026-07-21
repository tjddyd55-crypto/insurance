import { formatKoreanMobilePhone, formatKoreanResidentNumber } from '../../../utils/inputFormatters'
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
  return formatKoreanResidentNumber(text)
}

export function formatCustomerPhoneUi(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim()
  if (!text) {
    return ''
  }
  const digits = text.replace(/\D/g, '')
  if (digits.length < 10) {
    return text
  }
  return formatKoreanMobilePhone(text)
}

/**
 * birth_date 등 → YYYY.MM.DD. 없거나 파싱 불가면 '' (표시 생략).
 * 주민번호에서 추출하지 않는다.
 */
export function formatCustomerBirthDateDot(raw: string | Date | null | undefined): string {
  if (raw == null || raw === '') {
    return ''
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear()
    const m = String(raw.getMonth() + 1).padStart(2, '0')
    const d = String(raw.getDate()).padStart(2, '0')
    return `${y}.${m}.${d}`
  }
  const s = String(raw).trim()
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    return `${iso[1]}.${iso[2]}.${iso[3]}`
  }
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compact) {
    return `${compact[1]}.${compact[2]}.${compact[3]}`
  }
  const dotted = s.match(/^(\d{4})\.(\d{2})\.(\d{2})$/)
  if (dotted) {
    return `${dotted[1]}.${dotted[2]}.${dotted[3]}`
  }
  return ''
}

/**
 * 가족 그룹 구성원 보조정보: 관계 · 성별 · 생년월일 (빈 값 구분점 생략).
 * 성별은 formatCustomerGenderReadLabel 재사용. '-' 는 생략.
 */
export function formatRelationGroupMemberMetaLine(input: {
  relationshipLabel?: string | null
  gender?: 'male' | 'female' | null
  birthDate?: string | Date | null
}): string {
  const parts: string[] = []
  const relation = String(input.relationshipLabel ?? '').trim() || '관계 미지정'
  parts.push(relation)
  const genderLabel = formatCustomerGenderReadLabel(input.gender ?? null, null)
  if (genderLabel && genderLabel !== '-') {
    parts.push(genderLabel)
  }
  const birth = formatCustomerBirthDateDot(input.birthDate ?? null)
  if (birth) {
    parts.push(birth)
  }
  return parts.join(' · ')
}

export { formatCustomerMobileCarrierDisplay } from '../config/customerMobileCarrier.config'
