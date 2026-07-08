import {
  CUSTOMER_SPECIAL_DATE_PURPOSE_TYPES,
  type CustomerSpecialDatePurposeType,
} from '../types/customerSpecialDateForm'

export const DEFAULT_CUSTOMER_SPECIAL_DATE_PURPOSE: CustomerSpecialDatePurposeType = 'CELEBRATION'

export const CUSTOMER_SPECIAL_DATE_PURPOSE_LABELS: Record<CustomerSpecialDatePurposeType, string> = {
  CELEBRATION: '축하',
  THANKS: '감사',
  NOTICE: '안내',
  CHECKUP: '점검',
}

const PURPOSE_TYPE_SET = new Set<string>(CUSTOMER_SPECIAL_DATE_PURPOSE_TYPES)

/**
 * 임의의 입력값을 유효한 기념일 타입으로 보정한다.
 * 빈 값·미지의 값은 기본값(CELEBRATION)으로 수렴시켜, 빈 타입 때문에 저장/검증이
 * 실패하지 않도록 한다. (드롭다운 미선택·구 데이터 방어)
 */
export function normalizeCustomerSpecialDatePurposeType(
  raw: CustomerSpecialDatePurposeType | string | null | undefined,
): CustomerSpecialDatePurposeType {
  const key = String(raw ?? '').trim().toUpperCase()
  return PURPOSE_TYPE_SET.has(key)
    ? (key as CustomerSpecialDatePurposeType)
    : DEFAULT_CUSTOMER_SPECIAL_DATE_PURPOSE
}

export const CUSTOMER_SPECIAL_DATE_PURPOSE_OPTIONS: Array<{
  value: CustomerSpecialDatePurposeType
  label: string
}> = (Object.keys(CUSTOMER_SPECIAL_DATE_PURPOSE_LABELS) as CustomerSpecialDatePurposeType[]).map(
  (value) => ({
    value,
    label: CUSTOMER_SPECIAL_DATE_PURPOSE_LABELS[value],
  }),
)

export function labelForCustomerSpecialDatePurpose(
  purposeType: CustomerSpecialDatePurposeType | string | null | undefined,
): string {
  const key = String(purposeType ?? '').trim().toUpperCase() as CustomerSpecialDatePurposeType
  const fallback = String(purposeType ?? '').trim()
  return CUSTOMER_SPECIAL_DATE_PURPOSE_LABELS[key] ?? (fallback || '—')
}
