import { useState } from 'react'
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

function getNewsHero(item: AgentCustomerNewsItem): string | null {
  return item.heroImageUrl || item.attachments?.find((attachment) => attachment.kind === 'image')?.url || null
}

function formatDateOnly(iso: string | null): string {
  if (!iso) {
    return '—'
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toISOString().slice(0, 10)
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
  const [selectedNews, setSelectedNews] = useState<AgentCustomerNewsItem | null>(null)
  const selectedHero = selectedNews ? getNewsHero(selectedNews) : null
  const selectedFiles = selectedNews?.attachments?.filter((attachment) => attachment.kind !== 'image') ?? []

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
              const hero = getNewsHero(item)
              return (
                <article
                  key={item.id}
                  className="claim-requests-all-news-mobile__history-item claim-requests-all-news-mobile__history-item--summary"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedNews(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedNews(item)
                    }
                  }}
                >
                  {hero ? <img className="claim-requests-all-news-mobile__history-thumb" src={hero} alt="" /> : null}
                  <div className="claim-requests-all-news-mobile__summary-main">
                    <div className="claim-requests-all-news-mobile__history-title">{item.title || '전체소식지'}</div>
                    <div className="claim-requests-all-news-mobile__history-date">{formatDateTime(item.updatedAt)}</div>
                    <div className="claim-requests-all-news-mobile__history-excerpt">{item.content}</div>
                    {item.attachments && item.attachments.length > 0 ? (
                      <div className="claim-requests-all-news-mobile__attachments">첨부 {item.attachments.length}개</div>
                    ) : null}
                  </div>
                  <div className="claim-requests-all-news-mobile__summary-actions">
                    <span className="claim-requests-all-news-mobile__open-badge">미리보기</span>
                    <button
                      type="button"
                      className="claim-requests-all-news-mobile__delete-button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onDeleteNews(item)
                      }}
                      disabled={isDeleting || actionBusy}
                      aria-label={`${item.title || '전체소식지'} 삭제`}
                    >
                      {isDeleting ? '삭제 중…' : '삭제'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : null}
      </section>

      {selectedNews ? (
        <div className="claim-requests-all-news-mobile__preview-backdrop" role="dialog" aria-modal="true" aria-label="전체소식지 미리보기">
          <div className="claim-requests-all-news-mobile__preview-panel">
            <div className="claim-requests-all-news-mobile__preview-header">
              <strong>고객 화면 미리보기</strong>
              <button type="button" onClick={() => setSelectedNews(null)}>닫기</button>
            </div>
            <div className="claim-requests-all-news-mobile__preview-body">
              <article className="claim-requests-all-news-mobile__customer-card-preview">
                {selectedHero ? (
                  <div className="claim-requests-all-news-mobile__customer-hero-wrap">
                    <img className="claim-requests-all-news-mobile__customer-hero" src={selectedHero} alt="" />
                    <div className="claim-requests-all-news-mobile__customer-hero-overlay">
                      <h3>{selectedNews.title || '소식지'}</h3>
                      <p>{formatDateOnly(selectedNews.updatedAt)}</p>
                    </div>
                  </div>
                ) : null}
                {!selectedHero ? <h3 className="claim-requests-all-news-mobile__customer-title">{selectedNews.title || '소식지'}</h3> : null}
                <div className="claim-requests-all-news-mobile__customer-meta">최신 업데이트: {formatDateTime(selectedNews.updatedAt)}</div>
                <div className="claim-requests-all-news-mobile__customer-content">{selectedNews.content}</div>
                {selectedFiles.length > 0 ? (
                  <div className="claim-requests-all-news-mobile__customer-files">
                    <strong>첨부 파일</strong>
                    {selectedFiles.map((file) => (
                      <a key={file.id} href={file.url} target="_blank" rel="noreferrer">
                        {file.fileName || '첨부파일'}
                      </a>
                    ))}
                  </div>
                ) : null}
              </article>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
