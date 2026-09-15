import { labelForCustomerSpecialDatePurpose } from '../config/customerSpecialDatePurpose.config'
import type { CustomerSpecialDatePurposeType } from '../types/customerSpecialDateForm'

export const DEFAULT_ALERT_DATE_PURPOSE: CustomerSpecialDatePurposeType = 'NOTICE'

export function formatCustomerAlertDateLabel(item: {
  title: string
  purposeType: CustomerSpecialDatePurposeType
}): string {
  const title = String(item.title ?? '').trim()
  if (title) return title
  return labelForCustomerSpecialDatePurpose(item.purposeType) || '알림일'
}
