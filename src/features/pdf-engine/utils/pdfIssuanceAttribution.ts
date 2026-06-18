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

/** API/검색 row 에서 id 또는 customerId 를 읽어 summary 로 만든다. */
export function parsePdfCustomerSummaryFromUnknown(
  row: unknown,
): PdfSelectedCustomerSummary | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  const o = row as Record<string, unknown>
  const rawId = o.id ?? o.customerId
  const id = Number(rawId)
  if (!Number.isInteger(id) || id < 1) return null
  const nameRaw = o.name ?? o.customerName
  const name = String(nameRaw ?? '').trim() || `고객 #${id}`
  const phoneRaw = o.phone ?? o.phoneNumber ?? o.phone_number
  const phone =
    phoneRaw == null || phoneRaw === '' ? undefined : String(phoneRaw).trim() || undefined
  return phone ? { id, name, phone } : { id, name }
}

/**
 * 발급 저장 payload.
 * issuanceCustomerId = attributionCustomer?.id ?? appliedCustomer?.id
 */
export function buildPdfIssuanceSaveAttribution(
  attributionCustomer: PdfSelectedCustomerSummary | null,
  appliedCustomer: PdfSelectedCustomerSummary | null,
  appliedCustomerCarId: number | null,
  customerCars: CustomerCarRecord[],
): PdfIssuanceSaveAttribution {
  const source = attributionCustomer ?? appliedCustomer
  if (source == null) {
    return {}
  }
  const out: PdfIssuanceSaveAttribution = {
    issuanceCustomerId: source.id,
    customerSnapshot: {
      id: source.id,
      name: source.name,
      ...(source.phone?.trim() ? { phone: source.phone.trim() } : {}),
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

export function resolvePdfCustomerStatusMessage(input: {
  attributionCustomer: PdfSelectedCustomerSummary | null
  appliedCustomer: PdfSelectedCustomerSummary | null
}): string {
  const { attributionCustomer, appliedCustomer } = input
  if (appliedCustomer != null) {
    return `${appliedCustomer.name} 고객 데이터를 신청서에 반영했습니다.`
  }
  if (attributionCustomer != null) {
    return `이 신청서는 ${attributionCustomer.name} 고객에게 귀속됩니다. 고객 데이터는 아직 불러오지 않았습니다.`
  }
  return '고객이 선택되지 않았습니다. 고객 없이 작성하면 고객 미지정 내역으로 저장됩니다.'
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

export function formatVehicleSnapshotLabel(
  snapshot: PdfIssuanceVehicleSnapshot | Record<string, unknown> | null | undefined,
): string | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null
  const carNumber = String(snapshot.carNumber ?? '').trim()
  const carModel = String(snapshot.carModel ?? '').trim()
  if (carNumber && carModel) return `${carNumber} · ${carModel}`
  if (carNumber) return carNumber
  if (carModel) return carModel
  return null
}

/** 미리보기 시점 스냅샷과 현재 live 귀속 중 유효한 payload 를 고른다. */
export function resolveIssuanceAttributionForDownload(
  live: PdfIssuanceSaveAttribution,
  previewSnapshot: PdfIssuanceSaveAttribution,
): PdfIssuanceSaveAttribution {
  if (live.issuanceCustomerId != null) return live
  if (previewSnapshot.issuanceCustomerId != null) return previewSnapshot
  return {}
}
