import type { AgentCustomerNewsItem } from '../../api/claimRequestsApi'

type ClaimRequestsAllNewsMobileViewProps = {
  title: string
  content: string
  history: AgentCustomerNewsItem[]
  loading?: boolean
  actionBusy?: boolean
  deletingId?: string | null
  resultMessage?: string
  errorMessage?: string
  onTitleChange: (value: string) => void
  onContentChange: (value: string) => void
  onSend: () => void
  onDeleteNews: (item: AgentCustomerNewsItem) => void
  formatDateTime: (iso: string | null) => string
}

export default function ClaimRequestsAllNewsMobileView({
  title,
  content,
  history,
  loading = false,
  actionBusy = false,
  deletingId = null,
  resultMessage = '',
  errorMessage = '',
  onTitleChange,
  onContentChange,
  onSend,
  onDeleteNews,
  formatDateTime,
}: ClaimRequestsAllNewsMobileViewProps) {
  return (
    <main className="page claim-requests-page claim-requests-page--mobile claim-requests-all-news-mobile page--with-back content-wrapper">
      {errorMessage ? <p className="status status--error" role="alert">{errorMessage}</p> : null}
      {resultMessage ? <p className="status" role="status">{resultMessage}</p> : null}

      <section className="claim-requests-page__card claim-requests-all-news-mobile__compose-card">
        <div className="claim-requests-page__section-header">
          <div className="claim-requests-page__section-heading">
            <h2 className="claim-requests-page__section-title">전체소식지 작성</h2>
          </div>
          <button
            type="button"
            className="form-button button button--primary claim-requests-all-news-mobile__send-button"
            onClick={onSend}
            disabled={!title.trim() || !content.trim() || actionBusy}
          >
            {actionBusy ? '발송 중…' : '발송'}
          </button>
        </div>
        <input
          className="claim-requests-all-news-mobile__title-input"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="소식지 제목을 입력해 주세요."
          maxLength={120}
        />
        <textarea
          className="claim-requests-all-news-mobile__textarea"
          value={content}
          onChange={(event) => onContentChange(event.target.value)}
          placeholder="모든 고객에게 전달할 소식 내용을 입력해 주세요."
          maxLength={5000}
          rows={7}
        />
      </section>

      <section className="claim-requests-page__card claim-requests-all-news-mobile__history-card">
        <div className="claim-requests-page__section-header claim-requests-page__list-header">
          <div className="claim-requests-page__section-heading">
            <h2 className="claim-requests-page__section-title">발송 내역</h2>
          </div>
          <span className="claim-requests-page__list-count">총 {history.length}건</span>
        </div>

        {loading ? <div className="claim-requests-page__empty">전체소식지를 불러오는 중…</div> : null}
        {!loading && history.length === 0 ? (
          <div className="claim-requests-page__empty">발송한 전체소식지가 없습니다.</div>
        ) : null}

        {history.length > 0 ? (
          <div className="claim-requests-all-news-mobile__history-list">
            {history.map((item) => {
              const isDeleting = deletingId === item.id
              return (
                <article key={item.id} className="claim-requests-all-news-mobile__history-item">
                  <div className="claim-requests-all-news-mobile__history-header">
                    <div className="claim-requests-all-news-mobile__history-heading">
                      <div className="claim-requests-all-news-mobile__history-title">{item.title || '전체소식지'}</div>
                      <div className="claim-requests-all-news-mobile__history-date">{formatDateTime(item.updatedAt)}</div>
                    </div>
                    <button
                      type="button"
                      className="claim-requests-all-news-mobile__delete-button"
                      onClick={() => onDeleteNews(item)}
                      disabled={isDeleting || actionBusy}
                      aria-label={`${item.title || '전체소식지'} 삭제`}
                    >
                      {isDeleting ? '삭제 중…' : '삭제'}
                    </button>
                  </div>
                  <div className="claim-requests-all-news-mobile__history-content">{item.content}</div>
                  {item.attachments && item.attachments.length > 0 ? (
                    <div className="claim-requests-all-news-mobile__attachments">첨부 {item.attachments.length}개</div>
                  ) : null}
                </article>
              )
            })}
          </div>
        ) : null}
      </section>
    </main>
  )
}
