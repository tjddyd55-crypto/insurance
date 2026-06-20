/**
 * 전자서명 USER 발송 화면 route SSOT.
 * 고객 카드·워크스페이스에서 customerId를 query로 전달할 때 사용한다.
 */
export function buildContractSignatureSendPath(params: {
  customerId?: number
  returnTo?: string
}): string {
  const qs = new URLSearchParams()
  if (params.customerId != null && Number.isInteger(params.customerId) && params.customerId > 0) {
    qs.set('customerId', String(params.customerId))
  }
  const returnTo = params.returnTo?.trim()
  if (returnTo) {
    qs.set('returnTo', returnTo)
  }
  const query = qs.toString()
  return query ? `/contracts/signatures/send?${query}` : '/contracts/signatures/send'
}
