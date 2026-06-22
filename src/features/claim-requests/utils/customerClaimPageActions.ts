import type { CustomerAppLinkInfo } from '../api/claimRequestsApi'

/** 고객앱 연결 URL — 고객이 청구 파일을 올리는 진입점 */
export function getCustomerClaimPageUrl(info: CustomerAppLinkInfo | null | undefined): string {
  return String(info?.universalUrl ?? info?.connectUrl ?? '').trim()
}

/** 새 창(또는 팝업 차단 시 현재 창)으로 고객 청구 페이지를 연다. */
export function openCustomerClaimPageUrl(url: string): void {
  const href = String(url ?? '').trim()
  if (!href) {
    return
  }
  const opened = window.open(href, '_blank', 'noopener,noreferrer')
  if (!opened) {
    window.location.assign(href)
  }
}
