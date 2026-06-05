import type { CustomerCarRecord } from '../../customers/api/customerCarsApi'
import type { CustomerRecord } from '../../customers/domain/types'
import { formatCustomerCarRenewalYmd } from '../../customers/utils/resolveCustomerCarsForDisplay'

export {
  formatCustomerCarRenewalYmd,
  resolveCustomerCarsForPicker,
  sortCustomerCarsForPicker,
} from '../../customers/utils/resolveCustomerCarsForDisplay'

/** customer_cars API id 와 겹치지 않는 레거시(고객 행) 차량 가상 id — 첫 레거시 슬롯 */
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
