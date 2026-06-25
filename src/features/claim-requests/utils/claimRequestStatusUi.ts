import type { ClaimRequestStatus } from '../api/claimRequestsApi'

const STATUS_LABELS: Record<ClaimRequestStatus, string> = {
  requested: '요청됨',
  processing: '처리중',
  done: '완료',
  rejected: '반려',
  canceled: '취소',
}

const STATUS_BADGE_BASE = 'claim-request-status-badge'

export function claimRequestStatusLabel(status: ClaimRequestStatus | string): string {
  return STATUS_LABELS[status as ClaimRequestStatus] ?? String(status ?? '')
}

export function claimRequestStatusBadgeClass(status: ClaimRequestStatus | string): string {
  switch (status) {
    case 'done':
      return `${STATUS_BADGE_BASE} ${STATUS_BADGE_BASE}--completed`
    case 'processing':
      return `${STATUS_BADGE_BASE} ${STATUS_BADGE_BASE}--processing`
    case 'requested':
      return `${STATUS_BADGE_BASE} ${STATUS_BADGE_BASE}--requested`
    case 'rejected':
      return `${STATUS_BADGE_BASE} ${STATUS_BADGE_BASE}--rejected`
    case 'canceled':
      return `${STATUS_BADGE_BASE} ${STATUS_BADGE_BASE}--cancelled`
    default:
      return STATUS_BADGE_BASE
  }
}
