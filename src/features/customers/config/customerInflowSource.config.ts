/** 고객 유입 경로 — UI/API 공통 옵션 */

export const CUSTOMER_INFLOW_SOURCE_VALUES = [
  'DB수급',
  '소개',
  '지인',
  '기존고객',
  '광고/마케팅',
  '기타',
] as const

export type CustomerInflowSourceValue = (typeof CUSTOMER_INFLOW_SOURCE_VALUES)[number]

/** 유입 경로가 `소개`일 때 소개자 이름 입력 표시 */
export const CUSTOMER_INFLOW_SOURCE_REFERRAL = '소개' as const satisfies CustomerInflowSourceValue

export function isCustomerInflowSourceReferral(value: string | null | undefined): boolean {
  return String(value ?? '').trim() === CUSTOMER_INFLOW_SOURCE_REFERRAL
}

/** 저장 payload용 — 소개가 아니면 null */
export function resolveReferrerNameForSave(
  inflowSource: string | null | undefined,
  referrerName: string | null | undefined,
): string | null {
  if (!isCustomerInflowSourceReferral(inflowSource)) {
    return null
  }
  const trimmed = String(referrerName ?? '').trim()
  return trimmed || null
}

export const CUSTOMER_INFLOW_SOURCE_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '전체' },
  { value: '미지정', label: '미지정' },
  ...CUSTOMER_INFLOW_SOURCE_VALUES.map((v) => ({ value: v, label: v })),
]

export const CUSTOMER_INFLOW_SOURCE_FORM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '미지정' },
  ...CUSTOMER_INFLOW_SOURCE_VALUES.map((v) => ({ value: v, label: v })),
]

export function formatCustomerInflowSourceLabel(value: string | null | undefined): string {
  const s = String(value ?? '').trim()
  return s || '미지정'
}

export type CustomerListSortValue =
  | ''
  | 'createdDesc'
  | 'nameAsc'
  | 'lastConsultDesc'
  | 'lastConsultAsc'
  | 'noConsultFirst'

export const CUSTOMER_LIST_SORT_OPTIONS: Array<{ value: CustomerListSortValue; label: string }> = [
  { value: '', label: '기본(마지막 상담일)' },
  { value: 'createdDesc', label: '최근 등록순' },
  { value: 'nameAsc', label: '이름순' },
  { value: 'lastConsultDesc', label: '마지막 상담일 최신순' },
  { value: 'lastConsultAsc', label: '마지막 상담일 오래된순' },
  { value: 'noConsultFirst', label: '상담 없음 우선' },
]
