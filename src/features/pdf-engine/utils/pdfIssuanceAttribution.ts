import type { CustomerCarRecord } from '../../customers/api/customerCarsApi'
import type { PdfSelectedCustomerSummary } from '../pages/pdf-document/pdfDocumentApplicantViewProps'

export type PdfIssuanceCustomerSnapshot = {
  id: number
  name: string
  phone?: string
}

export type PdfIssuanceVehicleSnapshot = {
  id: number
  carNumber: string
  carModel: string
  carYear: string
  carType?: string
  renewalDate?: string | null
}

export type PdfIssuanceSaveAttribution = {
  issuanceCustomerId?: number
  customerSnapshot?: PdfIssuanceCustomerSnapshot
  vehicleSnapshot?: PdfIssuanceVehicleSnapshot
}

/** appliedCustomer·적용 차량 기준으로 발급 저장 payload 를 만든다. 미적용 시 빈 객체. */
export function buildPdfIssuanceSaveAttribution(
  appliedCustomer: PdfSelectedCustomerSummary | null,
  appliedCustomerCarId: number | null,
  customerCars: CustomerCarRecord[],
): PdfIssuanceSaveAttribution {
  if (appliedCustomer == null) {
    return {}
  }
  const out: PdfIssuanceSaveAttribution = {
    issuanceCustomerId: appliedCustomer.id,
    customerSnapshot: {
      id: appliedCustomer.id,
      name: appliedCustomer.name,
      ...(appliedCustomer.phone?.trim() ? { phone: appliedCustomer.phone.trim() } : {}),
    },
  }
  if (appliedCustomerCarId != null) {
    const car = customerCars.find((row) => row.id === appliedCustomerCarId)
    if (car) {
      out.vehicleSnapshot = {
        id: car.id,
        carNumber: car.carNumber,
        carModel: car.carModel,
        carYear: car.carYear,
        carType: car.carType,
        renewalDate: car.renewalDate,
      }
    }
  }
  return out
}

/** PDF 필드 매핑용 customerId — appliedCustomer 가 있을 때만 전송한다. */
export function resolvePdfMappingCustomerId(
  appliedCustomer: PdfSelectedCustomerSummary | null,
): number | undefined {
  const id = appliedCustomer?.id
  if (id == null || !Number.isInteger(id) || id < 1) return undefined
  return id
}

export function resolvePdfIssuanceLoadWarning(input: {
  issuanceCustomerId: number | null
  issuanceCustomerLabel: string | null
  contextCustomerId: number | null
}): string | null {
  const { issuanceCustomerId, issuanceCustomerLabel, contextCustomerId } = input
  if (issuanceCustomerId == null || contextCustomerId == null) {
    return null
  }
  if (issuanceCustomerId === contextCustomerId) {
    return null
  }
  const label = issuanceCustomerLabel?.trim() || `고객 #${issuanceCustomerId}`
  return `이 내역은 「${label}」 고객에게 귀속된 작성 내역입니다. 현재 작업 중인 고객과 다릅니다. 입력값만 불러오며 고객 귀속은 자동으로 바뀌지 않습니다.`
}

export function resolvePdfIssuanceUnassignedNotice(issuanceCustomerId: number | null): string | null {
  if (issuanceCustomerId != null) return null
  return '고객 미지정 내역입니다. 불러와도 현재 선택한 고객에게 자동 연결되지 않습니다.'
}

export function resolveIssuanceCustomerDisplayLabel(input: {
  customerId: number | null
  customerLabel: string | null
}): string {
  if (input.customerId == null) return '고객 미지정'
  return input.customerLabel?.trim() || `고객 #${input.customerId}`
}
