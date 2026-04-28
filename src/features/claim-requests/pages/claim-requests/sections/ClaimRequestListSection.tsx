import { FormButton } from '../../../../../components/form'
import type { ClaimRequestListItem, ClaimRequestStatus } from '../../../api/claimRequestsApi'

function claimListPreviewText(item: ClaimRequestListItem): string {
  const memo = item.memo?.trim()
  const title = item.title?.trim()
  const raw = memo || title || ''
  if (!raw) {
    return '내용 없음'
  }
  if (raw.length <= 140) {
    return raw
  }
  return `${raw.slice(0, 137)}…`
}

type ClaimRequestListSectionProps = {
  rows: ClaimRequestListItem[]
  selectedId?: number | null
  loading?: boolean
  showDescription?: boolean
  onSelectClaim: (id: number) => void
  formatDateTime: (iso: string | null) => string
  statusLabel: (status: ClaimRequestStatus) => string
  statusBadgeClass: (status: ClaimRequestStatus) => string
}

export default function ClaimRequestListSection({
  rows,
  selectedId,
  loading = false,
  showDescription = true,
  onSelectClaim,
  formatDateTime,
  statusLabel,
  statusBadgeClass,
}: ClaimRequestListSectionProps) {
  return (
    <section className="claim-requests-page__card claim-requests-page__list-section">
      <div className="claim-requests-page__section-header claim-requests-page__list-header">
        <div className="claim-requests-page__section-heading">
          <h2 className="claim-requests-page__section-title">청구 요청</h2>
          {showDescription ? (
            <p className="claim-requests-page__section-description">고객앱에서 접수된 청구 요청을 확인합니다.</p>
          ) : null}
        </div>
        <span className="claim-requests-page__list-count">총 {rows.length}건</span>
      </div>

      {loading ? <div className="claim-requests-page__empty">요청 목록을 불러오는 중…</div> : null}
      {!loading && rows.length === 0 ? <div className="claim-requests-page__empty">접수된 청구 요청이 없습니다.</div> : null}

      {rows.length > 0 ? (
        <div className="claim-requests-page__request-list">
          {rows.map((item) => {
            const openDetail = () => onSelectClaim(item.id)
            return (
              <article
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`${formatDateTime(item.submittedAt)} 청구 요청 상세 보기`}
                onClick={openDetail}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openDetail()
                  }
                }}
                className={
                  item.id === selectedId
                    ? 'claim-requests-page__request-card claim-requests-page__request-card--active'
                    : 'claim-requests-page__request-card'
                }
              >
                <div className="claim-requests-page__request-main">
                  <div className="claim-requests-page__request-meta claim-requests-page__request-meta--date">
                    {formatDateTime(item.submittedAt)}
                  </div>
                  <div className="claim-requests-page__request-text claim-requests-page__request-text--preview">
                    {claimListPreviewText(item)}
                  </div>
                  <div className="claim-requests-page__request-meta">첨부 {item.fileCount}개</div>
                </div>
                <div className="claim-requests-page__request-side">
                  <span className={statusBadgeClass(item.status)}>{statusLabel(item.status)}</span>
                  <FormButton
                    htmlType="button"
                    variant="secondary"
                    onClick={(event) => {
                      event.stopPropagation()
                      openDetail()
                    }}
                  >
                    상세
                  </FormButton>
                </div>
              </article>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
