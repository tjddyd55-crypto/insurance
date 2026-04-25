import type { AgentCustomerNewsItem, LinkedCustomerItem } from '../../api/claimRequestsApi'

type ClaimRequestsPersonalMobileViewProps = {
  targetCustomer?: LinkedCustomerItem | null
  targetCustomerId?: number | null
  message: string
  history: AgentCustomerNewsItem[]
  loading?: boolean
  actionBusy?: boolean
  resultMessage?: string
  errorMessage?: string
  onMessageChange: (value: string) => void
  onSend: () => void
  formatDateTime: (iso: string | null) => string
}

export default function ClaimRequestsPersonalMobileView({
  targetCustomer,
  targetCustomerId,
  message,
  history,
  loading = false,
  actionBusy = false,
  resultMessage = '',
  errorMessage = '',
  onMessageChange,
  onSend,
  formatDateTime,
}: ClaimRequestsPersonalMobileViewProps) {
  const targetName = targetCustomer?.customerName || (targetCustomerId ? '선택 고객' : '미선택')

  return (
    <main className="page claim-requests-page claim-requests-page--mobile claim-requests-personal-mobile page--with-back content-wrapper">
      {errorMessage ? <p className="status status--error" role="alert">{errorMessage}</p> : null}
      {resultMessage ? <p className="status" role="status">{resultMessage}</p> : null}

      <section className="claim-requests-page__card claim-requests-personal-mobile__target-card">
        <div className="claim-requests-page__section-header">
          <div className="claim-requests-page__section-heading">
            <h2 className="claim-requests-page__section-title">연결 고객</h2>
          </div>
        </div>
        <div className="claim-requests-personal-mobile__target-name">{targetName}</div>
        {targetCustomer ? (
          <div className="claim-requests-personal-mobile__target-meta">
            최근 접속 {formatDateTime(targetCustomer.lastConnectedAt)} · 연결 기기 {targetCustomer.deviceCount}대
          </div>
        ) : (
          <div className="claim-requests-personal-mobile__target-meta">
            고객관리에서 고객을 선택한 뒤 개인메시지를 작성합니다.
          </div>
        )}
      </section>

      <section className="claim-requests-page__card claim-requests-personal-mobile__compose-card">
        <div className="claim-requests-page__section-header">
          <div className="claim-requests-page__section-heading">
            <h2 className="claim-requests-page__section-title">개인메시지 작성</h2>
          </div>
          <button
            type="button"
            className="form-button button button--primary claim-requests-personal-mobile__send-button"
            onClick={onSend}
            disabled={!targetCustomerId || !message.trim() || actionBusy}
          >
            {actionBusy ? '발송 중…' : '발송'}
          </button>
        </div>
        <textarea
          className="claim-requests-personal-mobile__textarea"
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          placeholder="고객에게 전달할 개인메시지를 입력해 주세요."
          maxLength={2000}
          rows={5}
        />
      </section>

      <section className="claim-requests-page__card claim-requests-personal-mobile__history-card">
        <div className="claim-requests-page__section-header claim-requests-page__list-header">
          <div className="claim-requests-page__section-heading">
            <h2 className="claim-requests-page__section-title">발송 내역</h2>
          </div>
          <span className="claim-requests-page__list-count">총 {history.length}건</span>
        </div>

        {loading ? <div className="claim-requests-page__empty">개인메시지를 불러오는 중…</div> : null}
        {!loading && history.length === 0 ? (
          <div className="claim-requests-page__empty">해당 고객에게 발송한 개인메시지가 없습니다.</div>
        ) : null}

        {history.length > 0 ? (
          <div className="claim-requests-personal-mobile__history-list">
            {history.map((item) => (
              <article key={item.id} className="claim-requests-personal-mobile__history-item">
                <div className="claim-requests-personal-mobile__history-title">{item.title || '개인메시지'}</div>
                <div className="claim-requests-personal-mobile__history-date">{formatDateTime(item.updatedAt)}</div>
                <div className="claim-requests-personal-mobile__history-content">{item.content}</div>
                {item.attachments && item.attachments.length > 0 ? (
                  <div className="claim-requests-personal-mobile__attachments">
                    첨부 {item.attachments.length}개
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  )
}
