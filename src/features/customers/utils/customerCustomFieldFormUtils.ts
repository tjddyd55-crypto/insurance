import type { CustomerCustomFieldFormItem } from '../types/customerCustomFieldForm'

export const CUSTOMER_CUSTOM_FIELD_LABEL_MAX = 100
export const CUSTOMER_CUSTOM_FIELD_VALUE_MAX = 1000

export function createEmptyCustomerCustomField(): CustomerCustomFieldFormItem {
  return {
    label: '',
    value: '',
  }
}

function trim(s: string | undefined): string {
  return String(s ?? '').trim()
}

export function isCustomerCustomFieldEmpty(item: CustomerCustomFieldFormItem): boolean {
  return !trim(item.label) && !trim(item.value)
}

export function isCustomerCustomFieldPartial(item: CustomerCustomFieldFormItem): boolean {
  if (isCustomerCustomFieldEmpty(item)) {
    return false
  }
  return !trim(item.label) || !trim(item.value)
}

export function normalizeCustomerCustomFieldsForSave(
  items: CustomerCustomFieldFormItem[],
): CustomerCustomFieldFormItem[] {
  return items
    .filter((item) => !isCustomerCustomFieldEmpty(item))
    .map((item) => ({
      ...item,
      label: trim(item.label).slice(0, CUSTOMER_CUSTOM_FIELD_LABEL_MAX),
      value: trim(item.value).slice(0, CUSTOMER_CUSTOM_FIELD_VALUE_MAX),
    }))
}

export function getCustomerCustomFieldsValidationError(
  items: CustomerCustomFieldFormItem[],
): string | null {
  for (const item of items) {
    if (isCustomerCustomFieldEmpty(item)) {
      continue
    }
    if (isCustomerCustomFieldPartial(item)) {
      return '라벨과 내용을 모두 입력해 주세요.'
    }
    if (trim(item.label).length > CUSTOMER_CUSTOM_FIELD_LABEL_MAX) {
      return `라벨은 ${CUSTOMER_CUSTOM_FIELD_LABEL_MAX}자 이하로 입력해 주세요.`
    }
    if (trim(item.value).length > CUSTOMER_CUSTOM_FIELD_VALUE_MAX) {
      return `내용은 ${CUSTOMER_CUSTOM_FIELD_VALUE_MAX}자 이하로 입력해 주세요.`
    }
  }
  return null
}
