import FileUploader from '../../../../components/common/FileUploader'
import type { CustomerNewsMessageAttachmentDraft } from '../../model/customerNewsMessageAttachmentUpload'
import type { AgentCustomerNewsItem, LinkedCustomerItem } from '../../api/claimRequestsApi'

type ClaimRequestsPersonalMobileViewProps = {
  /** 고객 호칭 라벨(예: "김동훈 고객님께") — 고객번호 미포함 */
  targetHeading: string
  targetCustomer?: LinkedCustomerItem | null
  targetCustomerId?: number | null
  message: string
  draftAttachments?: CustomerNewsMessageAttachmentDraft[]
  uploadBusyText?: string | null
  history: AgentCustomerNewsItem[]
  loading?: boolean
  actionBusy?: boolean
  hasUploadingAttachment?: boolean
  deletingId?: string | null
  editingId?: string | null
  resultMessage?: string
  errorMessage?: string
  onMessageChange: (value: string) => void
  onAddAttachments: (files: File[]) => void
  onRemoveAttachment: (localId: string) => void
  validateFile: (file: File) => string | null
  onInvalidFiles: (message: string) => void
  onSend: () => void
  onStartEdit: (item: AgentCustomerNewsItem) => void
  onCancelEdit: () => void
  onDeleteMessage: (item: AgentCustomerNewsItem) => void
  formatDateTime: (iso: string | null) => string
}

function formatFileSize(bytes: number | undefined): string {
  const n = Number(bytes ?? 0)
  if (!Number.isFinite(n) || n < 1) {
    return ''
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)}KB`
  }
  return `${(n / (1024 * 1024)).toFixed(1)}MB`
}

export default function ClaimRequestsPersonalMobileView({
  targetHeading,
  targetCustomer,
  targetCustomerId,
  message,
  draftAttachments = [],
  uploadBusyText = null,
  history,
  loading = false,
  actionBusy = false,
  hasUploadingAttachment = false,
  deletingId = null,
  editingId = null,
  resultMessage = '',
  errorMessage = '',
  onMessageChange,
  onAddAttachments,
  onRemoveAttachment,
  validateFile,
  onInvalidFiles,
  onSend,
  onStartEdit,
  onCancelEdit,
  onDeleteMessage,
  formatDateTime,
}: ClaimRequestsPersonalMobileViewProps) {
  const targetLabel = targetCustomer?.customerName?.trim()
    ? targetCustomer.customerName.trim()
    : targetCustomerId
      ? '이름 불명'
      : '미선택'

  const isEditing = Boolean(editingId)
  const canSendContent = Boolean(message.trim()) || draftAttachments.length > 0
  const sendDisabled =
    !targetCustomerId ||
    (!isEditing && !canSendContent) ||
    (isEditing && !message.trim()) ||
    actionBusy ||
    hasUploadingAttachment ||
    (deletingId != null && deletingId !== '')

  return (
    <main className="page claim-requests-page claim-requests-page--mobile claim-requests-personal-mobile page--with-back content-wrapper">
      {errorMessage ? (
        <p className="status status--error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {resultMessage ? (
        <p className="status" role="status">
          {resultMessage}
        </p>
      ) : null}

      <section className="claim-requests-page__card claim-requests-personal-mobile__target-card">
        <div className="claim-requests-page__section-header">
          <div className="claim-requests-page__section-heading">
            <h2 className="claim-requests-page__section-title">연결 고객</h2>
          </div>
        </div>
        <div className="claim-requests-personal-mobile__target-heading">{targetHeading}</div>
        <div className="claim-requests-personal-mobile__target-name">{targetLabel}</div>
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
            <h2 className="claim-requests-page__section-title">{isEditing ? '개인메시지 수정' : '개인메시지 작성'}</h2>
          </div>
          <div className="claim-requests-personal-mobile__compose-actions">
            {isEditing ? (
              <button
                type="button"
                className="form-button button button--secondary claim-requests-personal-mobile__secondary-button"
                onClick={onCancelEdit}
                disabled={actionBusy}
              >
                취소
              </button>
            ) : null}
            <button
              type="button"
              className="form-button button button--primary claim-requests-personal-mobile__send-button"
              onClick={onSend}
              disabled={sendDisabled}
            >
              {actionBusy ? '처리 중…' : isEditing ? '저장' : '발송'}
            </button>
          </div>
        </div>
        <textarea
          className="claim-requests-personal-mobile__textarea"
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          placeholder="고객에게 전달할 개인메시지를 입력해 주세요."
          maxLength={2000}
          rows={5}
        />
        {!isEditing ? (
          <div className="claim-requests-personal-mobile__attachments-compose">
            <FileUploader
              accept="image/jpeg,image/png,.pdf,.xls,.xlsx,.csv"
              validateFile={validateFile}
              onFiles={onAddAttachments}
              onInvalidBatch={(failures) => onInvalidFiles(failures[0]?.message ?? '첨부할 수 없는 파일이 있습니다.')}
              multiple
              compact
              disabled={actionBusy}
              statusText={uploadBusyText ?? undefined}
              primaryHint="파일 첨부"
              hintLines={['JPG, PNG, PDF, XLS, XLSX, CSV (25MB)']}
            />
            {draftAttachments.length > 0 ? (
              <ul className="claim-requests-personal-mobile__draft-files">
                {draftAttachments.map((attachment) => (
                  <li key={attachment.localId} className="claim-requests-personal-mobile__draft-file">
                    <span className="claim-requests-personal-mobile__draft-file-name">{attachment.file.name}</span>
                    <span className="claim-requests-personal-mobile__draft-file-meta">
                      {formatFileSize(attachment.sizeBytes ?? attachment.file.size)}
                      {attachment.status === 'failed' ? ' · 업로드 실패' : null}
                      {attachment.status === 'uploading' ? ' · 업로드 중…' : null}
                    </span>
                    <button
                      type="button"
                      className="claim-requests-personal-mobile__draft-file-remove"
                      onClick={() => onRemoveAttachment(attachment.localId)}
                      disabled={actionBusy}
                    >
                      제거
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
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
            {history.map((item) => {
              const isDeleting = deletingId === item.id
              const attachments = item.attachments ?? []
              return (
                <article key={item.id} className="claim-requests-personal-mobile__history-item">
                  <div className="claim-requests-personal-mobile__history-header">
                    <div className="claim-requests-personal-mobile__history-heading">
                      <div className="claim-requests-personal-mobile__history-title">{targetHeading}</div>
                      <div className="claim-requests-personal-mobile__history-date">{formatDateTime(item.updatedAt)}</div>
                    </div>
                    <div className="claim-requests-personal-mobile__history-actions">
                      <button
                        type="button"
                        className="claim-requests-personal-mobile__edit-button"
                        onClick={() => onStartEdit(item)}
                        disabled={isDeleting || actionBusy}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="claim-requests-personal-mobile__delete-button"
                        onClick={() => onDeleteMessage(item)}
                        disabled={isDeleting || actionBusy}
                        aria-label="개인메시지 삭제"
                      >
                        {isDeleting ? '삭제 중…' : '삭제'}
                      </button>
                    </div>
                  </div>
                  <div className="claim-requests-personal-mobile__history-content">
                    {item.content || (attachments.length > 0 ? '첨부파일 메시지' : '')}
                  </div>
                  {attachments.length > 0 ? (
                    <ul className="claim-requests-personal-mobile__history-attachments">
                      {attachments.map((file) => (
                        <li key={file.id}>
                          <a
                            className="claim-requests-personal-mobile__history-attachment-link"
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {file.fileName || '첨부파일'}
                            {file.size ? ` (${formatFileSize(file.size)})` : ''}
                          </a>
                        </li>
                      ))}
                    </ul>
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
