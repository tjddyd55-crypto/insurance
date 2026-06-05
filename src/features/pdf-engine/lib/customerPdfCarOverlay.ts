import type { CustomerCarRecord } from '../../customers/api/customerCarsApi'
import type { CustomerRecord } from '../../customers/domain/types'
import { customerRecordToCarFormItemsForDisplay } from '../../customers/utils/customerCarFormUtils'

/** customer_cars API id 와 겹치지 않는 레거시(고객 행) 차량 가상 id */
export const LEGACY_PROFILE_CAR_ID = -1

/** 다중 차량 선택 시: 차량 전용 필드만 선택 차량(또는 미선택 시 빈 문자열)으로 덮어 PDF 입력용 CustomerRecord 를 만든다. */
export function customerWithSelectedCar(
  customer: CustomerRecord,
  car: CustomerCarRecord | null,
): CustomerRecord {
  if (!car) {
    return {
      ...customer,
      carNumber: '',
      carModel: '',
      carYear: '',
      renewalDate: '',
      carType: '',
    }
  }
  const rd = car.renewalDate ? String(car.renewalDate).slice(0, 10) : ''
  return {
    ...customer,
    carNumber: (car.carNumber ?? '').trim(),
    carModel: (car.carModel ?? '').trim(),
    carYear: (car.carYear ?? '').trim(),
    renewalDate: rd,
    carType: (car.carType ?? '').trim(),
  }
}

function legacyProfileCarFromCustomer(customer: CustomerRecord): CustomerCarRecord | null {
  const items = customerRecordToCarFormItemsForDisplay(customer)
  const car = items[0]
  if (!car) {
    return null
  }
  const renewal = car.renewalDate?.trim() ? car.renewalDate.trim().slice(0, 10) : null
  return {
    id: LEGACY_PROFILE_CAR_ID,
    customerId: customer.id,
    carType: (car.carType ?? '').trim(),
    carNumber: (car.carNumber ?? '').trim(),
    carModel: (car.carModel ?? '').trim(),
    carYear: (car.carYear ?? '').trim(),
    renewalDate: renewal,
    memo: (car.memo ?? '').trim(),
    isPrimary: true,
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
  }
}

/** API 차량 목록 + (비어 있으면) 고객 행 레거시 차량 1건 */
export function resolveCustomerCarsForPicker(
  apiCars: CustomerCarRecord[],
  customer: CustomerRecord,
): CustomerCarRecord[] {
  const sorted = sortCustomerCarsForPicker(apiCars)
  if (sorted.length > 0) {
    return sorted
  }
  const legacy = legacyProfileCarFromCustomer(customer)
  return legacy ? [legacy] : []
}

export function formatCustomerCarRenewalYmd(renewalDate: string | null | undefined): string {
  if (!renewalDate?.trim()) return ''
  return String(renewalDate).trim().slice(0, 10)
}

/** 차량 선택 UI 한 줄 요약 */
export function formatCustomerCarPickerSummary(car: CustomerCarRecord): string {
  const parts: string[] = []
  const num = car.carNumber?.trim()
  const model = car.carModel?.trim()
  const year = car.carYear?.trim()
  const renewal = formatCustomerCarRenewalYmd(car.renewalDate)
  const type = car.carType?.trim()
  if (num) parts.push(num)
  if (model) parts.push(model)
  if (year) parts.push(`연식 ${year}`)
  if (renewal) parts.push(`갱신 ${renewal}`)
  if (type) parts.push(type)
  return parts.join(' · ') || `차량 #${car.id}`
}

export function sortCustomerCarsForPicker(cars: CustomerCarRecord[]): CustomerCarRecord[] {
  return [...cars].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) {
      return a.isPrimary ? -1 : 1
    }
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder
    }
    return a.id - b.id
  })
}
