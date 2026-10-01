import FormButton from '../../../components/form/FormButton'
import type { CoverageShareListItem } from '../api/coverageSimulatorShareApi'
import { formatCoverageSeoulDateTimeLabel } from '../domain/formatConsultationDate'

type Props = {
  shares: CoverageShareListItem[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onCopyLink: (url: string | null) => void
  onRevoke: (shareId: string) => void
}

export function CoverageShareDialogHistory({
  shares,
  loading,
  error,
  onRetry,
  onCopyLink,
  onRevoke,
}: Props) {
  return (
    <section className="cs-share-dialog-history" aria-label="공유 이력">
      <h3 className="cs-share-dialog-history__title">공유 이력</h3>
      {loading ? <p className="cs-share-dialog-history__muted">불러오는 중…</p> : null}
      {error ? (
        <div className="cs-share-dialog-history__error">
          <p>{error}</p>
          <FormButton variant="secondary" className="coverage-simulator-secondary-btn cs-share-history__btn" onClick={onRetry}>
            다시 시도
          </FormButton>
        </div>
      ) : null}
      {!loading && !error && shares.length === 0 ? (
        <p className="cs-share-dialog-history__muted">아직 공유한 이력이 없습니다.</p>
      ) : null}
      {!error && shares.length > 0 ? (
        <ul className="cs-share-history__list">
          {shares.map((entry) => (
            <li key={entry.shareId} className="cs-share-history__item">
              <div className="cs-share-history__meta">
                <span>{formatCoverageSeoulDateTimeLabel(entry.createdAt)}</span>
                {entry.revokedAt ? <span className="cs-share-history__revoked">중지됨</span> : null}
              </div>
              <div className="cs-share-history__actions">
                <FormButton
                  variant="secondary"
                  className="coverage-simulator-secondary-btn cs-share-history__btn"
                  disabled={!entry.shareUrl}
                  onClick={() => onCopyLink(entry.shareUrl)}
                >
                  링크 복사
                </FormButton>
                {!entry.revokedAt ? (
                  <FormButton
                    variant="secondary"
                    className="coverage-simulator-secondary-btn cs-share-history__btn"
                    onClick={() => onRevoke(entry.shareId)}
                  >
                    공유 중지
                  </FormButton>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
