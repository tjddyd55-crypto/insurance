/**
 * 상담사/관리자 CRM 내부 고객 청구관리 화면 경로.
 * 고객앱(/customer-app) 링크와 분리한다.
 *
 * @param {{ customerId: number | string; claimRequestId?: number | string | null }} params
 */
export function buildInternalCustomerClaimRoute(params) {
  const customerId = Number(params?.customerId)
  if (!Number.isInteger(customerId) || customerId <= 0) {
    return ''
  }
  const base = `/customers/${customerId}/claim-requests`
  const claimRequestId = Number(params?.claimRequestId)
  if (Number.isInteger(claimRequestId) && claimRequestId > 0) {
    return `${base}?claimId=${claimRequestId}`
  }
  return base
}

/** 고객앱 청구 진입 URL 여부 — 내부 CRM 버튼에서 사용 금지 */
export function isCustomerAppClaimRoute(url) {
  const href = String(url ?? '').trim()
  if (!href) {
    return false
  }
  try {
    const pathname = href.startsWith('http') ? new URL(href).pathname : href
    return /\/customer-app(?:\/|$)/i.test(pathname)
  } catch {
    return /\/customer-app(?:\/|$)/i.test(href)
  }
}
