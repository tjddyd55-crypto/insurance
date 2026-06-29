import { FormButton, FormSelect, FormTextarea } from '../../../../../components/form'
import ClaimRequestAttachmentActions from '../../../components/ClaimRequestAttachmentActions'
import ClaimRequestFileActions from '../../../components/ClaimRequestFileActions'
import type {
  ClaimRequestDetail,
  ClaimRequestFileItem,
  ClaimRequestStatus,
} from '../../../api/claimRequestsApi'
import {
  claimRequestMessageText,
  formatClaimRequesterLine,
} from '../../../utils/claimRequestDetailFormatters'
import { claimRequestStatusBadgeClass } from '../../../utils/claimRequestStatusUi'
import { resolveClaimRequestCustomerId } from '../../../utils/resolveClaimRequestCustomerId'

type MaybePromise = void | Promise<void>

type ClaimRequestDetailSectionProps = {
  detail?: ClaimRequestDetail | null
  detailLoading?: boolean
  statusTarget: ClaimRequestStatus
  statusMemo: string
  actionBusy?: boolean
  statusOptions: Array<{ value: ClaimRequestStatus; label: string }>
  onStatusTargetChange: (status: ClaimRequestStatus) => void
  onStatusMemoChange: (memo: string) => void
  onUpdateStatus: () => MaybePromise
  onOpenFile: (file: ClaimRequestFileItem) => MaybePromise
  onDownloadFile: (file: ClaimRequestFileItem) => MaybePromise
  onDownloadZip?: () => MaybePromise
  onDownloadPdf?: () => MaybePromise
  zipBusy?: boolean
  pdfBusy?: boolean
  useNativeFileLinks?: boolean
  customerClaimPageUrl?: string
  customerClaimPageBusy?: boolean
  onOpenCustomerClaimPage?: () => MaybePromise
  customerPageTarget?: 'customer-app' | 'crm-internal'
  customerId?: number | null
  showCustomerClaimPage?: boolean
  embeddedInCustomerWorkspace?: boolean
  showStatusHistory?: boolean
  statusNotice?: string
  attachmentActionsVariant?: 'desktop' | 'mobile' | 'compact'
  formatDateTime: (iso: string | null) => string
  statusLabel: (status: ClaimRequestStatus) => string
}

export default function ClaimRequestDetailSection({
  detail,
  detailLoading = false,
  statusTarget,
  statusMemo,
  actionBusy = false,
  statusOptions,
  onStatusTargetChange,
  onStatusMemoChange,
  onUpdateStatus,
  onOpenFile,
  onDownloadFile,
  onDownloadZip,
  onDownloadPdf,
  zipBusy = false,
  pdfBusy = false,
  useNativeFileLinks = false,
  customerClaimPageUrl = '',
  customerClaimPageBusy = false,
  onOpenCustomerClaimPage,
  customerPageTarget = 'customer-app',
  customerId = null,
  showCustomerClaimPage = true,
  embeddedInCustomerWorkspace = false,
  showStatusHistory = true,
  statusNotice = '',
  attachmentActionsVariant = 'desktop',
  formatDateTime,
  statusLabel,
}: ClaimRequestDetailSectionProps) {
  return (
    <section className="claim-requests-page__card claim-requests-page__detail-card" aria-label="선택한 청구 요청 상세">
      <div className="claim-requests-page__section-header">
        <div>
          <h2 className="claim-requests-page__section-title">선택한 청구 요청 상세</h2>
          <p className="claim-requests-page__section-description">선택한 청구 요청의 첨부파일과 상태 이력을 확인합니다.</p>
        </div>
      </div>

      <ClaimRequestDetailBody
        detail={detail}
        detailLoading={detailLoading}
        statusTarget={statusTarget}
        statusMemo={statusMemo}
        actionBusy={actionBusy}
        statusOptions={statusOptions}
        onStatusTargetChange={onStatusTargetChange}
        onStatusMemoChange={onStatusMemoChange}
        onUpdateStatus={onUpdateStatus}
        onOpenFile={onOpenFile}
        onDownloadFile={onDownloadFile}
        onDownloadZip={onDownloadZip}
        onDownloadPdf={onDownloadPdf}
        zipBusy={zipBusy}
        pdfBusy={pdfBusy}
        useNativeFileLinks={useNativeFileLinks}
        customerClaimPageUrl={customerClaimPageUrl}
        customerClaimPageBusy={customerClaimPageBusy}
        onOpenCustomerClaimPage={onOpenCustomerClaimPage}
        customerPageTarget={customerPageTarget}
        customerId={customerId}
        showCustomerClaimPage={showCustomerClaimPage}
        embeddedInCustomerWorkspace={embeddedInCustomerWorkspace}
        showStatusHistory={showStatusHistory}
        statusNotice={statusNotice}
        attachmentActionsVariant={attachmentActionsVariant}
        formatDateTime={formatDateTime}
        statusLabel={statusLabel}
      />
    </section>
  )
}

type ClaimRequestDetailBodyProps = Omit<ClaimRequestDetailSectionProps, 'statusOptions'> & {
  statusOptions: Array<{ value: ClaimRequestStatus; label: string }>
}

export function ClaimRequestDetailBody({
  detail,
  detailLoading = false,
  statusTarget,
  statusMemo,
  actionBusy = false,
  statusOptions,
  onStatusTargetChange,
  onStatusMemoChange,
  onUpdateStatus,
  onOpenFile,
  onDownloadFile,
  onDownloadZip,
  onDownloadPdf,
  zipBusy = false,
  pdfBusy = false,
  useNativeFileLinks = false,
  customerClaimPageUrl = '',
  customerClaimPageBusy = false,
  onOpenCustomerClaimPage,
  customerPageTarget = 'customer-app',
  customerId = null,
  showCustomerClaimPage = true,
  embeddedInCustomerWorkspace = false,
  showStatusHistory = true,
  statusNotice = '',
  attachmentActionsVariant = 'desktop',
  formatDateTime,
  statusLabel,
}: ClaimRequestDetailBodyProps) {
  if (detailLoading) {
    return (
      <div className="claim-request-detail-surface">
        <div className="claim-requests-page__detail-empty">상세 불러오는 중…</div>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="claim-request-detail-surface">
        <div className="claim-requests-page__detail-empty">요청을 선택해 주세요.</div>
      </div>
    )
  }

  const requesterLine = formatClaimRequesterLine(detail)
  const messageText = claimRequestMessageText(detail)
  const saveDisabled = statusTarget === detail.status && !statusMemo.trim()
  const hasBundleActions = Boolean(onDownloadZip && onDownloadPdf)
  const resolvedCustomerId = resolveClaimRequestCustomerId(detail) ?? customerId

  return (
    <div className="claim-request-detail-surface claim-request-detail">
      <section className="claim-detail-section claim-detail-section--summary" aria-label="청구 요약">
        <div className="claim-detail-section__body">
          <div className="claim-detail-kv">
            <span className="claim-detail-kv__label">청구번호</span>
            <span className="claim-detail-kv__value">#{detail.id}</span>
          </div>
          <div className="claim-detail-kv">
            <span className="claim-detail-kv__label">접수일시</span>
            <span className="claim-detail-kv__value">{formatDateTime(detail.submittedAt)}</span>
          </div>
          {requesterLine ? (
            <div className="claim-detail-kv claim-detail-kv--requester">
              <span className="claim-detail-kv__label">요청자</span>
              <span className="claim-detail-kv__value">{requesterLine}</span>
            </div>
          ) : null}
        </div>
        <div className="claim-detail-section__status-pill">
          <span className={claimRequestStatusBadgeClass(detail.status)}>{statusLabel(detail.status)}</span>
        </div>
      </section>

      <section className="claim-detail-section claim-detail-section--message">
        <h4 className="claim-detail-section__title">요청 내용</h4>
        <div className="claim-detail-message-box">
          {messageText ? messageText : '요청 내용이 없습니다.'}
        </div>
      </section>

      <section className="claim-detail-section claim-detail-section--attachments">
        <div className="claim-detail-section__head-row">
          <h4 className="claim-detail-section__title">첨부 파일 {detail.files.length}개</h4>
          {hasBundleActions ? (
            <ClaimRequestAttachmentActions
              section="bundle"
              attachmentCount={detail.files.length}
              onDownloadZip={onDownloadZip!}
              onDownloadPdf={onDownloadPdf!}
              zipBusy={zipBusy}
              pdfBusy={pdfBusy}
              variant={attachmentActionsVariant}
              showCustomerClaimPage={false}
            />
          ) : null}
        </div>
        {detail.files.length === 0 ? (
          <div className="claim-detail-empty">첨부 파일이 없습니다.</div>
        ) : (
          <ul className="claim-requests-page__file-list">
            {detail.files.map((file) => (
              <li key={file.id} className="claim-requests-page__file-item">
                <span className="claim-requests-page__file-name" title={file.fileName}>
                  {file.fileName}
                </span>
                <span className="claim-requests-page__file-size">{(file.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                <ClaimRequestFileActions
                  file={file}
                  useNativeLinks={useNativeFileLinks}
                  onOpenFile={onOpenFile}
                  onDownloadFile={onDownloadFile}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="claim-detail-section claim-detail-section--status">
        <h4 className="claim-detail-section__title">상태 변경</h4>
        <div className="claim-status-control-row">
          <FormSelect
            className="claim-requests-page__status-select"
            value={statusTarget}
            onChange={(event) => onStatusTargetChange(event.target.value as ClaimRequestStatus)}
            options={statusOptions.map((item) => ({ value: item.value, label: item.label }))}
          />
          <FormButton
            htmlType="button"
            variant="primary"
            onClick={() => void onUpdateStatus()}
            loading={actionBusy}
            disabled={saveDisabled}
            title={saveDisabled ? '현재 상태와 동일하고 메모도 비어 있어 저장할 내용이 없습니다.' : undefined}
          >
            상태 저장
          </FormButton>
        </div>
        <FormTextarea
          className="claim-status-note-textarea"
          rows={5}
          value={statusMemo}
          onChange={(event) => onStatusMemoChange(event.target.value)}
          placeholder="상태 변경 메모 — 담당자 내부 기록용(상태 이력에 남습니다)"
          maxLength={255}
        />
        {statusNotice ? (
          <div className="claim-requests-page__status-notice" role="status" aria-live="polite">
            {statusNotice}
          </div>
        ) : null}
      </section>

      {showStatusHistory ? (
        <section className="claim-detail-section claim-detail-section--history">
          <h4 className="claim-detail-section__title">상태 이력</h4>
          {detail.statusLogs.length === 0 ? (
            <div className="claim-detail-empty">상태 이력이 없습니다.</div>
          ) : (
            <ul className="claim-requests-page__history-list">
              {detail.statusLogs.map((log) => (
                <li key={log.id} className="claim-requests-page__history-item">
                  <div className="claim-requests-page__history-main">
                    {log.fromStatus ? `${statusLabel(log.fromStatus)} → ` : ''}
                    {statusLabel(log.toStatus)}
                  </div>
                  <div className="claim-requests-page__history-meta">{formatDateTime(log.changedAt)}</div>
                  {log.memo ? <div className="claim-requests-page__history-memo">{log.memo}</div> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {hasBundleActions && !embeddedInCustomerWorkspace ? (
        <ClaimRequestAttachmentActions
          section="customerPage"
          attachmentCount={detail.files.length}
          customerClaimPageUrl={customerClaimPageUrl}
          customerClaimPageBusy={customerClaimPageBusy}
          customerPageTarget={customerPageTarget}
          customerId={resolvedCustomerId}
          onOpenCustomerClaimPage={onOpenCustomerClaimPage}
          showCustomerClaimPage={showCustomerClaimPage}
          onDownloadZip={onDownloadZip!}
          onDownloadPdf={onDownloadPdf!}
          zipBusy={zipBusy}
          pdfBusy={pdfBusy}
          variant={attachmentActionsVariant}
          className="claim-requests-page__attachment-actions--detail-footer"
        />
      ) : null}
    </div>
  )
}
