import FileUploader from '../../../../components/common/FileUploader'
import {
  CUSTOMER_WORKSPACE_MOBILE_SCOPE_CLASS,
  CustomerWorkspaceDangerActionButton,
  CustomerWorkspaceItemActions,
  CustomerWorkspacePrimaryActionButton,
  CustomerWorkspaceSecondaryActionButton,
} from '../../../customers/components/CustomerWorkspaceActionButtons'
import { resolveAbsoluteApiUrl } from '../../../../lib/apiClient'
import type { LocalAttachmentDraft } from '../../../insurer-news/types'
import type { AgentCustomerNewsItem, LinkedCustomerItem } from '../../api/claimRequestsApi'
import { isPersonalMessageSendDisabled } from '../../utils/personalMessageSendState'

type ClaimRequestsPersonalMobileViewProps = {
  /** 고객 호칭 라벨(예: "김동훈 고객님께") — 고객번호 미포함 */
  targetHeading: string
  targetCustomer?: LinkedCustomerItem | null
  targetCustomerId?: number | null
  message: string
  attachmentDrafts: LocalAttachmentDraft[]
  uploadBusyText?: string | null
  editingHasAttachments?: boolean
  history: AgentCustomerNewsItem[]
  loading?: boolean
  actionBusy?: boolean
  deletingId?: string | null
  editingId?: string | null
  resultMessage?: string
  errorMessage?: string
  onMessageChange: (value: string) => void
  onAddAttachments: (files: File[]) => void
  onRemoveAttachment: (localId: string) => void
  onInvalidAttachment: (message: string) => void
  validateAttachmentFile: (file: File) => string | null
  onSend: () => void
  onStartEdit: (item: AgentCustomerNewsItem) => void
  onCancelEdit: () => void
  onDeleteMessage: (item: AgentCustomerNewsItem) => void
  formatDateTime: (iso: string | null) => string
}

function formatFileSize(bytes: number | null | undefined): string {
  const n = Number(bytes ?? 0)
  if (!Number.isFinite(n) || n < 1) {
    return ''
  }
  if (n < 1024) {
    return `${n}B`
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)}KB`
  }
  return `${(n / (1024 * 1024)).toFixed(1)}MB`
}

function attachmentActionLabel(kind: 'image' | 'file'): string {
  return kind === 'image' ? '열기' : '다운로드'
}

export default function ClaimRequestsPersonalMobileView({
  targetHeading,
  targetCustomer,
  targetCustomerId,
  message,
  attachmentDrafts,
  uploadBusyText = null,
  editingHasAttachments = false,
  history,
  loading = false,
  actionBusy = false,
  deletingId = null,
  editingId = null,
  resultMessage = '',
  errorMessage = '',
  onMessageChange,
  onAddAttachments,
  onRemoveAttachment,
  onInvalidAttachment,
  validateAttachmentFile,
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
  const sendDisabled = isPersonalMessageSendDisabled({
    targetCustomerId,
    message,
    attachmentCount: attachmentDrafts.length,
    isEditing,
    actionBusy,
    deletingId,
  })

  return (
    <main
      className={`page claim-requests-page claim-requests-page--mobile claim-requests-personal-mobile page--with-back content-wrapper ${CUSTOMER_WORKSPACE_MOBILE_SCOPE_CLASS}`}
    >
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
              <CustomerWorkspaceSecondaryActionButton onClick={onCancelEdit} disabled={actionBusy}>
                취소
              </CustomerWorkspaceSecondaryActionButton>
            ) : null}
            <CustomerWorkspacePrimaryActionButton onClick={onSend} disabled={sendDisabled}>
              {actionBusy ? '처리 중…' : isEditing ? '저장' : '발송'}
            </CustomerWorkspacePrimaryActionButton>
          </div>
        </div>
        {isEditing && editingHasAttachments ? (
          <p className="claim-requests-personal-mobile__edit-attachment-note">
            첨부가 있는 메시지는 본문만 수정할 수 있습니다.
          </p>
        ) : null}
        <textarea
          className="claim-requests-personal-mobile__textarea"
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          placeholder="고객에게 전달할 개인메시지를 입력해 주세요."
          maxLength={2000}
          rows={5}
          disabled={actionBusy}
        />
        {!isEditing ? (
          <>
            <FileUploader
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.hwp,.hwpx"
              validateFile={validateAttachmentFile}
              onFiles={onAddAttachments}
              onInvalidBatch={(failures) =>
                onInvalidAttachment(failures[0]?.message ?? '첨부할 수 없는 파일이 있습니다.')
              }
              multiple
              compact
              disabled={actionBusy}
              statusText={uploadBusyText ?? undefined}
              primaryHint="파일 첨부"
              hintLines={['사진, PDF, 문서 파일을 첨부할 수 있습니다.']}
            />
            {attachmentDrafts.length > 0 ? (
              <ul className="claim-requests-personal-mobile__draft-files" aria-label="선택한 첨부파일">
                {attachmentDrafts.map((attachment) => {
                  const sizeLabel = formatFileSize(attachment.sizeBytes ?? attachment.file.size)
                  return (
                    <li key={attachment.localId} className="claim-requests-personal-mobile__draft-file">
                      <div className="claim-requests-personal-mobile__draft-file-main">
                        <span className="claim-requests-personal-mobile__draft-file-name">{attachment.file.name}</span>
                        {sizeLabel ? (
                          <span className="claim-requests-personal-mobile__draft-file-size">{sizeLabel}</span>
                        ) : null}
                      </div>
                      {attachment.status === 'uploading' ? (
                        <span className="claim-requests-personal-mobile__draft-file-status">업로드 중…</span>
                      ) : null}
                      {attachment.status === 'failed' ? (
                        <span className="claim-requests-personal-mobile__draft-file-status claim-requests-personal-mobile__draft-file-status--err">
                          {attachment.errorMessage ?? '업로드 실패'}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="claim-requests-personal-mobile__draft-file-remove"
                        onClick={() => onRemoveAttachment(attachment.localId)}
                        disabled={actionBusy}
                      >
                        제거
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </>
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
              const hasAttachments = attachments.length > 0
              const isEditingThis = editingId === item.id
              return (
                <article key={item.id} className="claim-requests-personal-mobile__history-item">
                  <div className="claim-requests-personal-mobile__history-header">
                    <div className="claim-requests-personal-mobile__history-heading">
                      <div className="claim-requests-personal-mobile__history-title">{targetHeading}</div>
                      <div className="claim-requests-personal-mobile__history-date">{formatDateTime(item.updatedAt)}</div>
                    </div>
                    <div className="claim-requests-personal-mobile__history-actions">
                      <CustomerWorkspaceItemActions>
                        <CustomerWorkspaceSecondaryActionButton
                          onClick={() => onStartEdit(item)}
                          disabled={isDeleting || actionBusy}
                        >
                          수정
                        </CustomerWorkspaceSecondaryActionButton>
                        <CustomerWorkspaceDangerActionButton
                          onClick={() => onDeleteMessage(item)}
                          disabled={isDeleting || actionBusy}
                          aria-label="개인메시지 삭제"
                        >
                          {isDeleting ? '삭제 중…' : '삭제'}
                        </CustomerWorkspaceDangerActionButton>
                      </CustomerWorkspaceItemActions>
                    </div>
                  </div>
                  <div className="claim-requests-personal-mobile__history-content">
                    {item.content?.trim() ? item.content : '내용 없이 첨부파일만 보낸 메시지입니다.'}
                  </div>
                  {hasAttachments ? (
                    <div className="claim-requests-personal-mobile__attachments">
                      <div className="claim-requests-personal-mobile__attachments-summary">
                        첨부 {attachments.length}개
                        {isEditingThis ? ' · 수정 시 첨부는 유지되고 본문만 바뀝니다.' : null}
                      </div>
                      <ul className="claim-requests-personal-mobile__attachment-list">
                        {attachments.map((file) => {
                          const href = resolveAbsoluteApiUrl(String(file.url ?? '').trim())
                          const sizeLabel = formatFileSize(file.size)
                          return (
                            <li key={file.id} className="claim-requests-personal-mobile__attachment-item">
                              <div className="claim-requests-personal-mobile__attachment-meta">
                                <span className="claim-requests-personal-mobile__attachment-name">
                                  {file.fileName || '첨부파일'}
                                </span>
                                {sizeLabel ? (
                                  <span className="claim-requests-personal-mobile__attachment-size">{sizeLabel}</span>
                                ) : null}
                              </div>
                              {href ? (
                                <a
                                  className="claim-requests-personal-mobile__attachment-action"
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {attachmentActionLabel(file.kind)}
                                </a>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
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
