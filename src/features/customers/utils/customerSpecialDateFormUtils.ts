import type { CustomerSpecialDateFormItem } from '../types/customerSpecialDateForm'

export function createEmptyCustomerSpecialDate(): CustomerSpecialDateFormItem {
  return {
    purposeType: 'CELEBRATION',
    title: '',
    dateValue: '',
    memo: '',
  }
}

function trim(s: string | undefined): string {
  return String(s ?? '').trim()
}

export function isCustomerSpecialDateEmpty(item: CustomerSpecialDateFormItem): boolean {
  return !trim(item.title) && !trim(item.dateValue) && !trim(item.memo)
}

export function isCustomerSpecialDatePartial(item: CustomerSpecialDateFormItem): boolean {
  if (isCustomerSpecialDateEmpty(item)) {
    return false
  }
  return !trim(item.title) || !trim(item.dateValue)
}

export function normalizeCustomerSpecialDatesForSave(
  items: CustomerSpecialDateFormItem[],
): CustomerSpecialDateFormItem[] {
  return items.filter((item) => !isCustomerSpecialDateEmpty(item))
}

export function getCustomerSpecialDatesValidationError(items: CustomerSpecialDateFormItem[]): string | null {
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    if (isCustomerSpecialDateEmpty(item)) {
      continue
    }
    if (!trim(item.title)) {
      return `기념일 ${i + 1}: 라벨을 입력해 주세요.`
    }
    const date = trim(item.dateValue).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return `기념일 ${i + 1}: 날짜를 YYYY-MM-DD 형식으로 입력해 주세요.`
    }
  }
  return null
}
