import type { CustomerFireInsuranceLocationFormItem } from '../types/customerFireInsuranceLocationForm'

export function createEmptyCustomerFireInsuranceLocation(): CustomerFireInsuranceLocationFormItem {
  return { address: '', memo: '' }
}

function trim(s: string | undefined): string {
  return String(s ?? '').trim()
}

function isLocationEmpty(item: CustomerFireInsuranceLocationFormItem): boolean {
  return !trim(item.address) && !trim(item.memo)
}

/** 저장 시 완전히 빈 항목은 제외 */
export function normalizeCustomerFireInsuranceLocationsForSave(
  items: CustomerFireInsuranceLocationFormItem[],
): CustomerFireInsuranceLocationFormItem[] {
  return items
    .map((item) => ({
      id: item.id,
      address: trim(item.address),
      memo: trim(item.memo),
    }))
    .filter((item) => !isLocationEmpty(item))
}

/** 편집 초기화 — 데이터 없으면 빈 소재지 1개 */
export function ensureCustomerFireInsuranceLocationFormItems(
  items: CustomerFireInsuranceLocationFormItem[],
): CustomerFireInsuranceLocationFormItem[] {
  if (items.length === 0) {
    return [createEmptyCustomerFireInsuranceLocation()]
  }
  return items
}
