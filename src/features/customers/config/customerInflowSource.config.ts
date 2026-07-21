/** 고객 유입 경로 — UI/API 공통 옵션 */

export const CUSTOMER_INFLOW_SOURCE_VALUES = [
  'DB수급',
  '소개',
  '지인',
  '기존고객',
  '광고/마케팅',
  '기타',
  '이관고객',
] as const

export type CustomerInflowSourceValue = (typeof CUSTOMER_INFLOW_SOURCE_VALUES)[number]

/** 유입 경로가 `소개`일 때 소개자 이름 입력 표시 */
export const CUSTOMER_INFLOW_SOURCE_REFERRAL = '소개' as const satisfies CustomerInflowSourceValue

/** 유입 경로가 `이관고객`일 때 이관한 사람 이름 입력 표시 */
export const CUSTOMER_INFLOW_SOURCE_TRANSFERRED =
  '이관고객' as const satisfies CustomerInflowSourceValue

/** 상세 이름(referrerName) 입력이 필요한 유입 경로 */
const INFLOW_SOURCES_REQUIRING_DETAIL = new Set<string>([
  CUSTOMER_INFLOW_SOURCE_REFERRAL,
  CUSTOMER_INFLOW_SOURCE_TRANSFERRED,
])

export function isCustomerInflowSourceReferral(value: string | null | undefined): boolean {
  return String(value ?? '').trim() === CUSTOMER_INFLOW_SOURCE_REFERRAL
}

export function isCustomerInflowSourceTransferred(value: string | null | undefined): boolean {
  return String(value ?? '').trim() === CUSTOMER_INFLOW_SOURCE_TRANSFERRED
}

/** 소개·이관고객처럼 상세 이름 입력이 필요한지 */
export function requiresInflowSourceDetail(value: string | null | undefined): boolean {
  return INFLOW_SOURCES_REQUIRING_DETAIL.has(String(value ?? '').trim())
}

export type InflowSourceDetailFieldMeta = {
  label: string
  placeholder: string
  /** 상세 보기용 짧은 라벨 */
  readLabel: string
}

/** 유입 경로별 상세 입력 라벨/placeholder (해당 없으면 null) */
export function getInflowSourceDetailFieldMeta(
  value: string | null | undefined,
): InflowSourceDetailFieldMeta | null {
  const s = String(value ?? '').trim()
  if (s === CUSTOMER_INFLOW_SOURCE_REFERRAL) {
    return {
      label: '소개자 이름',
      placeholder: '예: 홍길동',
      readLabel: '소개자',
    }
  }
  if (s === CUSTOMER_INFLOW_SOURCE_TRANSFERRED) {
    return {
      label: '이관한 사람',
      placeholder: '누구의 고객을 이관했는지 입력해 주세요.',
      readLabel: '이관한 사람',
    }
  }
  return null
}

/**
 * 저장 payload용 — 상세 입력이 필요한 유입 경로가 아니면 null.
 * 동일 DB 컬럼 `referrer_name` 재사용.
 */
export function resolveReferrerNameForSave(
  inflowSource: string | null | undefined,
  referrerName: string | null | undefined,
): string | null {
  if (!requiresInflowSourceDetail(inflowSource)) {
    return null
  }
  const trimmed = String(referrerName ?? '').trim()
  return trimmed || null
}

/**
 * 상세 보기용 한 줄 표시.
 * 예: `이관고객 · 김영희` / 상세 없으면 `이관고객` / 미지정이면 `미지정`
 */
export function formatCustomerInflowSourceDisplay(
  inflowSource: string | null | undefined,
  referrerName?: string | null,
): string {
  const sourceLabel = formatCustomerInflowSourceLabel(inflowSource)
  if (!requiresInflowSourceDetail(inflowSource)) {
    return sourceLabel
  }
  const detail = String(referrerName ?? '').trim()
  if (!detail) {
    return sourceLabel
  }
  return `${sourceLabel} · ${detail}`
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
