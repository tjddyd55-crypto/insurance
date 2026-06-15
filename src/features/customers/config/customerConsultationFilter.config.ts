/** 고객 목록 — 상담 여부 필터 (UI·API 공통 개념) */
export type CustomerConsultationFilterValue = '' | 'none' | 'has' | 'no_since'

export const CUSTOMER_CONSULTATION_FILTER_OPTIONS: {
  value: CustomerConsultationFilterValue
  label: string
}[] = [
  { value: '', label: '전체' },
  { value: 'has', label: '상담 있음' },
  { value: 'none', label: '상담 없음' },
  { value: 'no_since', label: '선택 날짜 이후 상담 없음' },
]

/** 서버 consultationStatus 쿼리 값 (신규 별칭 포함) */
export type CustomerConsultationStatusParam =
  | 'all'
  | 'none'
  | 'has'
  | 'no_since'
  | 'has_consultation'
  | 'no_consultation'
  | 'no_consultation_since'
