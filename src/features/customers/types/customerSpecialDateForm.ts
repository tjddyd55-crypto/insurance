export const CUSTOMER_SPECIAL_DATE_PURPOSE_TYPES = [
  'CELEBRATION',
  'THANKS',
  'NOTICE',
  'CHECKUP',
] as const

export type CustomerSpecialDatePurposeType = (typeof CUSTOMER_SPECIAL_DATE_PURPOSE_TYPES)[number]

export type CustomerSpecialDateFormItem = {
  id?: number
  purposeType: CustomerSpecialDatePurposeType
  title: string
  dateValue: string
  memo?: string
}
