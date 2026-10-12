import { useEffect, useMemo, useState } from 'react'
import { FormDialog, useConfirmDialog } from '../../../components/dialog'
import { StatusMessage } from '../../../components/feedback'
import { FieldWrapper, FormButton, FormInput, FormTextarea } from '../../../components/form'
import { estimateSmsByteLength } from '../../sms/utils/smsMessageMeta'
import { sendCrmUserBulkSms, type CrmUserBulkSmsRuntime } from '../api/crmUserBulkSmsApi'
import { formatCrmUserBulkSmsResultMessage } from '../crmUserBulkSmsResultMessage'

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

function resolveResultTitle(result: {
  dryRun?: boolean
  campaign: { dryRun: boolean; successCount: number; failedCount: number }
}): string {
  if (result.dryRun || result.campaign.dryRun) return '테스트 모드'
  if (result.campaign.successCount > 0 && result.campaign.failedCount === 0) return '발송 요청'
  if (result.campaign.successCount > 0 && result.campaign.failedCount > 0) return '일부 발송'
  return '발송 실패'
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
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle('서비스 안내')
    setMessage('')
    setError('')
  }, [open])

  const localType = useMemo(() => resolveLocalSmsType(message), [message])
  const byteCount = useMemo(() => estimateSmsByteLength(message), [message])
  const audienceCount = selectedUserIds.length
  const dirty = title !== '서비스 안내' || message.trim() !== ''

  const requestClose = async () => {
    if (busy) return
    if (dirty) {
      const discard = await confirm({
        title: '작성 중인 내용이 있습니다',
        message: '변경사항이 저장되지 않았습니다. 닫으시겠습니까?',
        tone: 'danger',
        confirmLabel: '닫기',
      })
      if (!discard) return
    }
    onClose()
  }

  const runSend = async () => {
    if (!message.trim() || audienceCount < 1) {
      setError('내용과 발송 대상이 있어야 합니다.')
      return
    }
    const confirmed = await confirm({
      title: `사용자 ${audienceCount}명에게 문자를 보낼까요?`,
      message: `선택한 사용자 ${audienceCount}명에게 같은 제목과 내용을 발송합니다. 발송 후에는 취소할 수 없습니다.`,
      tone: 'danger',
      confirmLabel: '보내기',
    })
    if (!confirmed) return

    setBusy(true)
    setError('')
    try {
      const result = await sendCrmUserBulkSms(token, {
        userIds: selectedUserIds,
        message,
        title,
        idempotencyKey: crypto.randomUUID(),
      })
      await confirm({
        title: resolveResultTitle(result),
        message: formatCrmUserBulkSmsResultMessage(result),
        tone: 'default',
        confirmLabel: '확인',
      })
      onSent()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '문자 발송에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <FormDialog
        open={open}
        onClose={() => {
          void requestClose()
        }}
        title="사용자 단체문자 보내기"
        panelClassName="admin-modal-panel admin-user-bulk-sms-modal"
        overlayClassName="admin-modal-backdrop admin-user-bulk-sms-modal-backdrop"
        closeOnBackdrop={false}
        closeOnEsc={!busy}
        footer={
          <div className="admin-user-bulk-sms-modal__footer admin-modal-actions">
            <FormButton
              htmlType="button"
              variant="secondary"
              className="button button--secondary"
              onClick={() => {
                void requestClose()
              }}
              disabled={busy}
            >
              취소
            </FormButton>
            <FormButton
              htmlType="button"
              variant="primary"
              className="button button--primary"
              onClick={() => void runSend()}
              disabled={busy || !message.trim() || audienceCount < 1}
              loading={busy}
              loadingText="보내는 중…"
            >
              보내기
            </FormButton>
          </div>
        }
      >
        <div className="admin-user-bulk-sms-modal__body">
          <p className="admin-user-bulk-sms-modal__hint">
            선택한 CRM 사용자에게 안내 문자를 발송합니다. 광고·홍보성 문자는 이 기능으로 발송할 수
            없습니다.
          </p>
          {runtime && !runtime.realSendEnabled ? (
            <p className="admin-user-bulk-sms-modal__hint">
              테스트 모드입니다. 실제 문자는 발송되지 않습니다.
            </p>
          ) : null}
          <StatusMessage message={error} tone="error" className="m-0" />

          <FieldWrapper label="제목" className="admin-modal-field">
            <FormInput
              className="admin-form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
              placeholder="예: 서비스 안내"
            />
          </FieldWrapper>

          <div className="admin-modal-field admin-user-bulk-sms-modal__message-field">
            <div className="admin-user-bulk-sms-modal__message-label-row">
              <span className="field__label">내용</span>
              <span className="admin-user-bulk-sms-modal__message-meta">
                {byteCount}byte · 예상 {localType}
              </span>
            </div>
            <FormTextarea
              className="admin-user-bulk-sms-modal__textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={busy}
              rows={6}
              placeholder="{사용자명}님, 서비스 점검 안내드립니다."
            />
            <p className="admin-user-bulk-sms-modal__vars">
              변수: {'{사용자명}'} {'{아이디}'} {'{소속명}'} {'{서비스명}'}
            </p>
          </div>

          <div className="admin-modal-field admin-user-bulk-sms-modal__audience">
            <span className="field__label">발송 대상</span>
            <p className="admin-user-bulk-sms-modal__hint">
              선택한 사용자 {audienceCount}명 · 같은 제목과 내용을 보냅니다.
            </p>
          </div>
        </div>
      </FormDialog>
      {confirmDialog}
    </>
  )
}
