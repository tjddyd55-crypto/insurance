import type { ClaimRequestListItem } from '../api/claimRequestsApi'
import { claimRequestListPreviewText } from '../utils/claimRequestListPreview'
import { claimRequestStatusBadgeClass, claimRequestStatusLabel } from '../utils/claimRequestStatusUi'

type ClaimRequestListCardProps = {
  item: ClaimRequestListItem
  active?: boolean
  onClick: () => void
  formatDateTime: (iso: string | null) => string
}

export default function ClaimRequestListCard({
  item,
  active = false,
  onClick,
  formatDateTime,
}: ClaimRequestListCardProps) {
  const requesterName = item.requesterName || item.customerName || '고객'
  const preview = claimRequestListPreviewText(item)

  return (
    <button
      type="button"
      className={`claim-request-list-card${active ? ' claim-request-list-card--active' : ''}`}
      onClick={onClick}
    >
      <div className="claim-request-list-card__header">
        <div className="claim-request-list-card__title">
          #{item.id} {requesterName}
        </div>
        <span className={claimRequestStatusBadgeClass(item.status)}>{claimRequestStatusLabel(item.status)}</span>
      </div>
      <div className="claim-request-list-card__meta">
        {item.customerName} · {formatDateTime(item.submittedAt)} · 파일 {item.fileCount}개
      </div>
      <div className="claim-request-list-card__body">{preview}</div>
    </button>
  )
}
