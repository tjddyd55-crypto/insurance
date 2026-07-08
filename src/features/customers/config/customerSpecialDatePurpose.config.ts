import type { CustomerSpecialDatePurposeType } from '../types/customerSpecialDateForm'

export const CUSTOMER_SPECIAL_DATE_PURPOSE_LABELS: Record<CustomerSpecialDatePurposeType, string> = {
  CELEBRATION: '축하',
  THANKS: '감사',
  NOTICE: '안내',
  CHECKUP: '점검',
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
