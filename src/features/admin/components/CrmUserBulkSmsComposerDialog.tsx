import { useEffect, useMemo, useState } from 'react'
import { FormDialog, useConfirmDialog } from '../../../components/dialog'
import { StatusMessage } from '../../../components/feedback'
import { FieldWrapper, FormButton, FormInput, FormTextarea } from '../../../components/form'
import { estimateSmsByteLength } from '../../sms/utils/smsMessageMeta'
import {
  previewCrmUserBulkSms,
  sendCrmUserBulkSms,
  type CrmUserBulkSmsPreview,
  type CrmUserBulkSmsRuntime,
} from '../api/crmUserBulkSmsApi'

type Props = {
  open: boolean
  token: string
  selectedUserIds: string[]
  runtime: CrmUserBulkSmsRuntime | null
  onClose: () => void
  onSent: () => void
}

function resolveLocalSmsType(message: string): 'SMS' | 'LMS' {
  return estimateSmsByteLength(message) <= 90 ? 'SMS' : 'LMS'
}

export default function CrmUserBulkSmsComposerDialog({
  open,
  token,
  selectedUserIds,
  runtime,
  onClose,
  onSent,
}: Props) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [title, setTitle] = useState('서비스 안내')
  const [message, setMessage] = useState('')
  const [senderNumber, setSenderNumber] = useState('')
  const [preview, setPreview] = useState<CrmUserBulkSmsPreview | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle('서비스 안내')
    setMessage('')
    setSenderNumber(runtime?.defaultSender ?? '')
    setPreview(null)
    setError('')
  }, [open, runtime?.defaultSender])

  const localType = useMemo(() => resolveLocalSmsType(message), [message])
  const byteCount = useMemo(() => estimateSmsByteLength(message), [message])

  const runPreview = async () => {
    setError('')
    setBusy(true)
    try {
      const data = await previewCrmUserBulkSms(token, {
        userIds: selectedUserIds,
        message,
        title,
        senderNumber: senderNumber || undefined,
      })
      setPreview(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '미리보기에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const runSend = async () => {
    if (!preview || preview.summary.eligibleCount < 1) {
      setError('미리보기 후 발송 가능 대상이 있어야 합니다.')
      return
    }
    const dryHint = preview.runtime.realSendEnabled
      ? '실발송이 활성화되어 있습니다.'
      : '현재는 dry-run(실제 발송 없음)입니다.'
    const confirmed = await confirm({
      title: `사용자 ${preview.summary.eligibleCount}명에게 문자를 보낼까요?`,
      message: `선택한 CRM 사용자 ${preview.summary.eligibleCount}명에게 안내 문자를 즉시 발송합니다. 발송 후에는 취소할 수 없습니다. ${dryHint}`,
      tone: 'danger',
      confirmLabel: '발송',
    })
    if (!confirmed) return

    setBusy(true)
    setError('')
    try {
      const result = await sendCrmUserBulkSms(token, {
        userIds: selectedUserIds,
        message,
        title,
        senderNumber: senderNumber || undefined,
        idempotencyKey: crypto.randomUUID(),
        confirm: true,
      })
      const mode = result.dryRun || result.campaign.dryRun ? 'dry-run' : '실발송'
      await confirm({
        title: '발송 요청 완료',
        message: `캠페인 #${result.campaign.id} (${mode}) · 성공 ${result.campaign.successCount} · 실패 ${result.campaign.failedCount} · 제외 ${result.campaign.excludedCount}`,
        tone: 'default',
        confirmLabel: '확인',
      })
      onSent()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '발송에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <FormDialog
        open={open}
        onClose={() => {
          if (!busy) onClose()
        }}
        title="사용자 단체문자 보내기"
        panelClassName="admin-modal-panel admin-user-bulk-sms-modal"
        overlayClassName="admin-modal-backdrop"
        closeOnBackdrop={false}
        closeOnEsc={!busy}
        panelPreset="largeForm"
      >
        <div className="admin-modal-content admin-user-bulk-sms-modal__body">
          <p className="admin-user-bulk-sms-modal__hint">
            선택한 CRM 사용자에게 안내 문자를 발송합니다. 광고·홍보성 문자는 이 기능으로 발송할 수
            없습니다.
          </p>
          <StatusMessage message={error} tone="error" className="m-0" />

          <FieldWrapper label="발송명 (관리자용)" className="admin-modal-field">
            <FormInput
              className="admin-form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
              placeholder="예: 7월 업데이트 안내"
            />
          </FieldWrapper>

          <FieldWrapper label="발신번호" className="admin-modal-field">
            <FormInput
              className="admin-form-input"
              value={senderNumber}
              onChange={(e) => setSenderNumber(e.target.value)}
              disabled={busy}
              placeholder="숫자만 입력"
            />
          </FieldWrapper>

          <FieldWrapper
            label={`문자 내용 (${byteCount}byte · 예상 ${localType})`}
            className="admin-modal-field"
          >
            <FormTextarea
              className="admin-form-input admin-user-bulk-sms-modal__textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={busy}
              rows={6}
              placeholder="{사용자명}님, 서비스 점검 안내드립니다."
            />
          </FieldWrapper>
          <p className="admin-user-bulk-sms-modal__vars">
            변수: {'{사용자명}'} {'{아이디}'} {'{소속명}'} {'{서비스명}'}
          </p>

          {preview ? (
            <div className="admin-user-bulk-sms-modal__preview">
              <p>
                선택 {preview.summary.targetCount}명 · 발송 가능 {preview.summary.eligibleCount}명 ·
                제외 {preview.summary.excludedCount}명 · {preview.summary.smsType}
                {preview.runtime.realSendEnabled ? '' : ' · dry-run'}
              </p>
              <ul className="admin-user-bulk-sms-modal__preview-list">
                {preview.recipients.slice(0, 12).map((r) => (
                  <li key={r.userId}>
                    {r.displayName || r.username || r.userId} · {r.phoneMasked}
                    {r.status === 'EXCLUDED' ? ` · 제외(${r.exclusionReason})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="admin-modal-actions">
          <FormButton
            htmlType="button"
            variant="secondary"
            className="button button--secondary"
            onClick={onClose}
            disabled={busy}
          >
            취소
          </FormButton>
          <FormButton
            htmlType="button"
            variant="secondary"
            className="button button--secondary"
            onClick={() => void runPreview()}
            disabled={busy || !message.trim() || selectedUserIds.length === 0}
            loading={busy && !preview}
            loadingText="미리보기…"
          >
            미리보기
          </FormButton>
          <FormButton
            htmlType="button"
            variant="primary"
            className="button button--primary"
            onClick={() => void runSend()}
            disabled={busy || !preview || preview.summary.eligibleCount < 1}
            loading={busy && Boolean(preview)}
            loadingText="발송 중…"
          >
            발송
          </FormButton>
        </div>
      </FormDialog>
      {confirmDialog}
    </>
  )
}
