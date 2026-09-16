import type { CustomerBusinessInfo } from '../../domain/customerBusinessInfo'
import { isCustomerBusinessInfoFormEmpty } from '../../domain/customerBusinessInfo'
import type { CustomerCarFormItem } from '../../types/customerCarForm'
import { isCustomerCarEmpty } from '../../utils/customerCarFormUtils'
import type { CustomerFireInsuranceLocationFormItem } from '../../types/customerFireInsuranceLocationForm'
import type { CustomerSpecialDateFormItem } from '../../types/customerSpecialDateForm'
import { getCustomerSpecialDatesValidationError } from '../../utils/customerSpecialDateFormUtils'

export function getCustomerCarQuickCrudValidationError(car: CustomerCarFormItem): string | null {
  if (isCustomerCarEmpty(car)) {
    return '차량 정보를 입력해 주세요.'
  }
  return null
}

export function getCustomerFireInsuranceQuickCrudValidationError(
  item: CustomerFireInsuranceLocationFormItem,
): string | null {
  if (!String(item.address ?? '').trim()) {
    return '주소를 검색해 주세요.'
  }
  return null
}

export function getCustomerBusinessQuickCrudValidationError(
  info: CustomerBusinessInfo,
): string | null {
  if (isCustomerBusinessInfoFormEmpty(info)) {
    return '사업자 정보를 입력해 주세요.'
  }
  return null
}

export function getCustomerSpecialDateQuickCrudValidationError(
  item: CustomerSpecialDateFormItem,
): string | null {
  return getCustomerSpecialDatesValidationError([item])
}
