import type { AgentCustomerNewsItem } from '../../api/claimRequestsApi'

export type AllNewsAttachmentDraft = {
  localId: string
  file: File
  kind: 'image' | 'file'
  previewUrl: string | null
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  errorMessage?: string
  cdnUrl?: string
  objectKey?: string
  mimeType?: string
  sizeBytes?: number
  storageFileId?: number
}

type ClaimRequestsAllNewsMobileViewProps = {
  title: string
  content: string
  attachments: AllNewsAttachmentDraft[]
  history: AgentCustomerNewsItem[]
  loading?: boolean
  actionBusy?: boolean
  deletingId?: string | null
  resultMessage?: string
  errorMessage?: string
  onTitleChange: (value: string) => void
  onContentChange: (value: string) => void
  onFilesSelected: (files: FileList | File[]) => void
  onRemoveAttachment: (localId: string) => void
  onSend: () => void
  onDeleteNews: (item: AgentCustomerNewsItem) => void
  formatDateTime: (iso: string | null) => string
}

const statusLabel: Record<AllNewsAttachmentDraft['status'], string> = {
  pending: '대기',
  uploading: '업로드 중',
  completed: '완료',
  failed: '실패',
}

export default function ClaimRequestsAllNewsMobileView({
  title,
  content,
  attachments,
  history,
  loading = false,
  actionBusy = false,
  deletingId = null,
  resultMessage = '',
  errorMessage = '',
  onTitleChange,
  onContentChange,
  onFilesSelected,
  onRemoveAttachment,
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

        <div className="claim-requests-all-news-mobile__upload-field">
          <span className="claim-requests-all-news-mobile__upload-label">대표 이미지 / 첨부</span>
          <label className="claim-requests-all-news-mobile__dropzone">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              multiple
              disabled={actionBusy}
              onChange={(event) => {
                if (event.currentTarget.files?.length) {
                  onFilesSelected(event.currentTarget.files)
                }
                event.currentTarget.value = ''
              }}
            />
            <span>이미지 또는 PDF를 선택해 주세요.</span>
            <small>첫 번째 이미지는 고객앱 카드 대표 이미지로 사용됩니다. 각 파일 최대 10MB</small>
          </label>
          {attachments.length > 0 ? (
            <div className="claim-requests-all-news-mobile__attachment-list">
              {attachments.map((item) => (
                <div key={item.localId} className="claim-requests-all-news-mobile__attachment-row">
                  {item.kind === 'image' && item.previewUrl ? (
                    <img className="claim-requests-all-news-mobile__attachment-thumb" src={item.previewUrl} alt="" />
                  ) : (
                    <div className="claim-requests-all-news-mobile__attachment-pdf">PDF</div>
                  )}
                  <div className="claim-requests-all-news-mobile__attachment-info">
                    <p className="claim-requests-all-news-mobile__attachment-name">{item.file.name || '첨부파일'}</p>
                    <p className={`claim-requests-all-news-mobile__attachment-status claim-requests-all-news-mobile__attachment-status--${item.status}`}>
                      {statusLabel[item.status]}
                      {item.errorMessage ? ` — ${item.errorMessage}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="claim-requests-all-news-mobile__attachment-remove"
                    onClick={() => onRemoveAttachment(item.localId)}
                    disabled={actionBusy}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
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
              const hero = item.heroImageUrl || item.attachments?.find((attachment) => attachment.kind === 'image')?.url || null
              return (
                <article key={item.id} className="claim-requests-all-news-mobile__history-item">
                  {hero ? <img className="claim-requests-all-news-mobile__history-hero" src={hero} alt="" /> : null}
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
