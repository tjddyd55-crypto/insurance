/** PDF 신청서에서 차량·고객 매핑에 사용하는 canonical customer id 파서 */
export function parsePdfApplicationCustomerId(raw: string | null | undefined): number | null {
  if (raw == null || raw === '') {
    return null
  }
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : null
}

/** customerId 없이 이름만 있는 경우 차량 API 조회를 하지 않는다 */
export function canLoadCustomerCarsForApplication(customerId: number | null | undefined): customerId is number {
  return Number.isInteger(customerId) && customerId >= 1
}
