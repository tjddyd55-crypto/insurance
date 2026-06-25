import type { ClaimRequestStatus } from '../api/claimRequestsApi'

const STATUS_LABELS: Record<ClaimRequestStatus, string> = {
  requested: '요청됨',
  processing: '처리중',
  done: '완료',
  rejected: '반려',
  canceled: '취소',
}

export function claimRequestStatusLabel(status: ClaimRequestStatus | string): string {
  return STATUS_LABELS[status as ClaimRequestStatus] ?? String(status ?? '')
}

export function claimRequestStatusBadgeClass(status: ClaimRequestStatus | string): string {
  switch (status) {
    case 'done':
      return 'claim-requests-page__badge claim-requests-page__badge--done'
    case 'processing':
      return 'claim-requests-page__badge claim-requests-page__badge--processing'
    case 'requested':
      return 'claim-requests-page__badge claim-requests-page__badge--requested'
    case 'rejected':
      return 'claim-requests-page__badge claim-requests-page__badge--rejected'
    case 'canceled':
      return 'claim-requests-page__badge claim-requests-page__badge--canceled'
    default:
      return 'claim-requests-page__badge'
  }
}
