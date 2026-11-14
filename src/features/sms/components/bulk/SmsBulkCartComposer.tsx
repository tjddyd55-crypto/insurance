import { useEffect, useRef, useState } from 'react'
import FormButton from '../../../../components/form/FormButton'
import FormSelect from '../../../../components/form/FormSelect'
import FormInput from '../../../../components/form/FormInput'
import { useConfirmDialog } from '../../../../components/dialog'
import type { SmsModuleViewProps } from '../../hooks/useSmsModuleState'
import type { SmsBulkRecipientState } from '../../hooks/useSmsBulkRecipientState'
import { formatKrMobileDisplay } from '../../smsDisplayUtils'
import SmsComposerLayout from '../composer/SmsComposerLayout'

type Props = {
  variant: 'pc' | 'mobile'
  module: SmsModuleViewProps
  bulkState: SmsBulkRecipientState
  adDisplayName: string
}

/** One-off campaigns use the cart, independently of saved group membership/rules. */
export default function SmsBulkCartComposer({ variant, module, bulkState, adDisplayName }: Props) {
  const { bulkForm, setBulkForm, busy, settings, preview, previewAcknowledged } = module
  const { summary, sendableCustomerIds } = bulkState
  const customerIdsText = sendableCustomerIds.join(',')
  const [scheduled, setScheduled] = useState(false)
  const [approvedKey, setApprovedKey] = useState<string | null>(null)
  const pendingKey = useRef<string | null>(null)
  const { confirm, confirmDialog } = useConfirmDialog()
  const signature = JSON.stringify([
    customerIdsText,
    bulkForm.message,
    bulkForm.senderNumber,
    bulkForm.messageType,
  ])
  const synced = bulkForm.customerIdsText === customerIdsText
  const currentPreview = approvedKey === signature && previewAcknowledged && preview
  const disabled = busy || bulkState.groupActionBusy || !synced

  useEffect(() => {
    setBulkForm((prev) =>
      prev.customerIdsText === customerIdsText ? prev : { ...prev, customerIdsText },
    )
  }, [customerIdsText, setBulkForm])

  useEffect(() => {
    if (preview && pendingKey.current) {
      setApprovedKey(pendingKey.current)
      pendingKey.current = null
    }
  }, [preview])

  const previewCart = async () => {
    setApprovedKey(null)
    pendingKey.current = signature
    await module.handlePreviewBulk()
  }
  const send = async () => {
    if (
      scheduled &&
      (!Number.isFinite(new Date(bulkForm.scheduledAt).getTime()) ||
        new Date(bulkForm.scheduledAt).getTime() <= Date.now())
    ) {
      await confirm({
        title: '예약 일시 확인',
        message: '현재보다 이후의 예약 일시를 선택해주세요.',
        hideCancel: true,
      })
      return
    }
    if (
      await confirm({
        title: scheduled ? '예약발송 저장' : '문자 발송',
        message: `발송 가능 ${summary.sendable}명에게 ${scheduled ? '예약발송을 저장' : '문자를 발송'}하시겠습니까?`,
        confirmLabel: scheduled ? '예약 저장' : '발송',
      })
    ) {
      await module.handleCreateBulk(scheduled)
      setApprovedKey(null)
    }
  }

  return (
    <>
      <p>
        발송 대상 {summary.total}명 / 발송 가능 {summary.sendable}명 / 제외 {summary.excluded}명
      </p>
      <SmsComposerLayout
        variant={variant}
        showPreview={false}
        message={bulkForm.message}
        onMessageChange={(message) => setBulkForm((prev) => ({ ...prev, message }))}
        isAdvertisement={bulkForm.messageType === 'ad'}
        onAdvertisementChange={(checked) =>
          setBulkForm((prev) => ({ ...prev, messageType: checked ? 'ad' : 'info' }))
        }
        senderNumber={bulkForm.senderNumber || settings?.defaultSender}
        adDisplayName={adDisplayName}
        realSendEnabled={Boolean(settings?.realSendEnabled)}
        disabled={busy}
        setupFields={
          <div className="sms-module__grid">
            <label>
              템플릿
              <FormSelect
                className="sms-module__select"
                value=""
                options={[
                  { value: '', label: '템플릿 불러오기' },
                  ...module.templates.map((row) => ({ value: String(row.id), label: row.title })),
                ]}
                disabled={busy}
                onChange={(e) => {
                  const template = module.templates.find((row) => String(row.id) === e.target.value)
                  if (template) module.handleLoadTemplateToSend(template)
                }}
              />
            </label>
            <label>
              발송 제목
              <FormInput
                value={bulkForm.title}
                disabled={busy}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </label>
            <label>
              발신번호
              <FormSelect
                options={[
                  { value: '', label: '선택' },
                  ...module.verifiedSenders.map((row) => ({
                    value: row.senderNumber,
                    label: formatKrMobileDisplay(row.senderNumber),
                  })),
                ]}
                className="sms-module__select"
                value={bulkForm.senderNumber}
                disabled={busy}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, senderNumber: e.target.value }))}
              />
            </label>
            <label>
              발송 방식
              <FormSelect
                options={[
                  { value: 'immediate', label: '즉시발송' },
                  { value: 'reserved', label: '예약발송' },
                ]}
                className="sms-module__select"
                value={scheduled ? 'reserved' : 'immediate'}
                disabled={busy}
                onChange={(e) => setScheduled(e.target.value === 'reserved')}
              />
            </label>
            {scheduled ? (
              <label>
                예약 일시
                <FormInput
                  type="datetime-local"
                  value={bulkForm.scheduledAt}
                  disabled={busy}
                  onChange={(e) =>
                    setBulkForm((prev) => ({ ...prev, scheduledAt: e.target.value }))
                  }
                />
              </label>
            ) : null}
          </div>
        }
        actions={
          <div className="sms-module__actions">
            <FormButton
              htmlType="button"
              variant="secondary"
              disabled={disabled || summary.sendable === 0}
              onClick={() => void previewCart()}
            >
              발송 미리보기
            </FormButton>
            <FormButton
              htmlType="button"
              disabled={
                disabled ||
                summary.sendable === 0 ||
                !bulkForm.message.trim() ||
                (scheduled ? !bulkForm.scheduledAt : !currentPreview || !settings?.realSendEnabled)
              }
              onClick={() => void send()}
            >
              {scheduled ? '예약 저장' : '문자 발송'}
            </FormButton>
            {summary.total === 0 ? <p>발송 대상을 먼저 선택해주세요.</p> : null}
            {!settings?.realSendEnabled ? (
              <p className="sms-composer__send-disabled-note">
                실발송 비활성 상태입니다. 현재는 미리보기/예약 저장만 가능합니다.
              </p>
            ) : null}
          </div>
        }
        below={
          <div className="sms-module__preview">
            <p>
              예상 발송 {currentPreview ? preview.sendableCount : summary.sendable}건
              {currentPreview ? ` / 제외 ${preview.skippedCount}건` : ' · 미리보기로 확인해주세요.'}
            </p>
            <p className="sms-module__muted">
              예상 비용은 알리고 계약 단가에 따라 달라집니다. 잔액과 발송 가능 건수를 확인해주세요.
            </p>
            <FormButton
              htmlType="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void module.handleFetchBalance()}
            >
              잔액 조회
            </FormButton>
            {module.balanceText ? <p>{module.balanceText}</p> : null}
          </div>
        }
      />
      {confirmDialog}
    </>
  )
}
