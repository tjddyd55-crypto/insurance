import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import { useAuth } from '../../../auth/AuthProvider'
import {
  SMS_SCHEDULE_MONTH_DAY_MAX,
  SMS_SCHEDULE_MONTH_DAY_MIN,
  SMS_SCHEDULE_TYPE_OPTIONS,
  SMS_SCHEDULE_WEEKDAY_OPTIONS,
} from '../../config/smsScheduled.config'
import { useSmsMessageComposeMeta } from '../../hooks/useSmsMessageComposeMeta'
import { useSmsScheduledState } from '../../hooks/useSmsScheduledState'
import { useSmsSendGroupSelection } from '../../hooks/useSmsSendGroupSelection'
import type { SmsModuleViewProps } from '../../hooks/useSmsModuleState'
import type { SmsTemplate } from '../../types/sms.types'
import type { SmsScheduledRule } from '../../types/smsScheduled.types'
import { buildScheduleListCardMeta, buildScheduleSummary, formatNextRunAtLabel } from '../../utils/smsScheduledSummary'
import { formatKrMobileDisplay } from '../../smsDisplayUtils'
import SmsComposerLayout from '../composer/SmsComposerLayout'
import SmsPhonePreview from '../composer/SmsPhonePreview'
import { useConfirmDialog } from '../../../../components/dialog'

type Props = {
  variant: 'pc' | 'mobile'
  module: SmsModuleViewProps
  initialSendMode: 'immediate' | 'reserved'
  adDisplayName: string
}

function SendModeSelector({
  value,
  onChange,
  disabled,
}: {
  value: 'immediate' | 'reserved'
  onChange: (value: 'immediate' | 'reserved') => void
  disabled?: boolean
}) {
  return (
    <div className="sms-send-mode" role="radiogroup" aria-label="발송 방식">
      <button
        type="button"
        role="radio"
        aria-checked={value === 'immediate'}
        className={`sms-send-mode__btn${value === 'immediate' ? ' sms-send-mode__btn--active' : ''}`}
        disabled={disabled}
        onClick={() => onChange('immediate')}
      >
        즉시 발송
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === 'reserved'}
        className={`sms-send-mode__btn${value === 'reserved' ? ' sms-send-mode__btn--active' : ''}`}
        disabled={disabled}
        onClick={() => onChange('reserved')}
      >
        예약 발송
      </button>
    </div>
  )
}

function ReservedScheduleFields({
  form,
  updateForm,
  disabled,
}: {
  form: ReturnType<typeof useSmsScheduledState>['form']
  updateForm: ReturnType<typeof useSmsScheduledState>['updateForm']
  disabled?: boolean
}) {
  return (
    <div className="sms-send-schedule-fields">
      <label>
        예약명
        <FormInput
          value={form.name}
          disabled={disabled}
          placeholder="예: 보험 만기 안내"
          onChange={(e) => updateForm({ name: e.target.value })}
        />
      </label>
      <div className="sms-scheduled-form__block">
        <span className="sms-scheduled-form__label">예약 주기</span>
        <div className="sms-scheduled-segment" role="radiogroup" aria-label="예약 주기">
          {SMS_SCHEDULE_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`sms-scheduled-segment__btn${form.scheduleType === option.value ? ' sms-scheduled-segment__btn--active' : ''}`}
              disabled={disabled}
              onClick={() => updateForm({ scheduleType: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {form.scheduleType === 'once' ? (
        <label>
          발송 날짜
          <FormInput type="date" value={form.sendDate} disabled={disabled} onChange={(e) => updateForm({ sendDate: e.target.value })} />
        </label>
      ) : null}
      {form.scheduleType === 'weekly' ? (
        <div className="sms-scheduled-form__block">
          <span className="sms-scheduled-form__label">요일 선택</span>
          <div className="sms-scheduled-weekdays">
            {SMS_SCHEDULE_WEEKDAY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`sms-scheduled-weekday${form.weekdays.includes(option.value) ? ' sms-scheduled-weekday--active' : ''}`}
                disabled={disabled}
                onClick={() => {
                  const next = form.weekdays.includes(option.value)
                    ? form.weekdays.filter((d) => d !== option.value)
                    : [...form.weekdays, option.value]
                  updateForm({ weekdays: next })
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {form.scheduleType === 'monthly' ? (
        <>
          <label>
            매월 일자
            <select
              className="sms-module__select"
              value={form.monthDay}
              disabled={disabled}
              onChange={(e) => updateForm({ monthDay: Number(e.target.value) })}
            >
              {Array.from({ length: SMS_SCHEDULE_MONTH_DAY_MAX - SMS_SCHEDULE_MONTH_DAY_MIN + 1 }, (_, index) => {
                const day = index + SMS_SCHEDULE_MONTH_DAY_MIN
                return (
                  <option key={day} value={day}>
                    {day}일
                  </option>
                )
              })}
            </select>
          </label>
          <p className="sms-scheduled-form__hint">선택한 날짜가 없는 달에는 해당 월 마지막 날에 발송됩니다.</p>
        </>
      ) : null}
      <label>
        발송 시간
        <FormInput type="time" value={form.sendTime} disabled={disabled} onChange={(e) => updateForm({ sendTime: e.target.value })} />
      </label>
      <p className="sms-scheduled-form__hint">발송 시간은 한국 시간 기준입니다.</p>
    </div>
  )
}

function ReservedRulesSection({
  rules,
  groups,
  disabled,
  onEdit,
  onCopy,
  onDelete,
}: {
  rules: SmsScheduledRule[]
  groups: { id: number; name: string }[]
  disabled?: boolean
  onEdit: (ruleId: string) => void
  onCopy: (rule: SmsScheduledRule) => void
  onDelete: (rule: SmsScheduledRule) => void
}) {
  const { confirm, confirmDialog } = useConfirmDialog()

  const handleDelete = async (rule: SmsScheduledRule) => {
    const ok = await confirm({
      title: '예약 삭제',
      message: '예약문자를 삭제하시겠습니까?\n삭제하면 해당 예약 규칙은 더 이상 실행되지 않습니다.',
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'danger',
    })
    if (ok) {
      onDelete(rule)
    }
  }

  return (
    <>
      <section className="sms-send-reserved-list">
        <h3 className="sms-send-section__title">예약현황</h3>
        {rules.length === 0 ? (
          <p className="sms-module__muted">저장된 예약문자가 없습니다.</p>
        ) : (
          <ul className="sms-send-reserved-list__items">
            {rules.map((rule) => {
              const groupName = groups.find((g) => String(g.id) === rule.recipientGroupId)?.name ?? '미지정'
              return (
                <li key={rule.id} className="sms-send-reserved-card">
                  <p className="sms-send-reserved-card__name">{rule.name}</p>
                  <p className="sms-send-reserved-card__meta">그룹: {groupName}</p>
                  <p className="sms-send-reserved-card__meta">{buildScheduleSummary(rule)}</p>
                  <p className="sms-send-reserved-card__meta">다음 실행: {formatNextRunAtLabel(rule.nextRunAt)}</p>
                  <p className="sms-send-reserved-card__meta">상태: {rule.enabled ? '활성' : '비활성'}</p>
                  <div className="sms-send-reserved-card__actions">
                    <FormButton type="button" variant="secondary" disabled={disabled} onClick={() => onEdit(rule.id)}>
                      수정
                    </FormButton>
                    <FormButton type="button" variant="secondary" disabled={disabled} onClick={() => onCopy(rule)}>
                      복사
                    </FormButton>
                    <FormButton type="button" variant="secondary" disabled={disabled} onClick={() => void handleDelete(rule)}>
                      삭제
                    </FormButton>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {confirmDialog}
    </>
  )
}

export default function SmsSendWorkspace({ variant, module, initialSendMode, adDisplayName }: Props) {
  const navigate = useNavigate()
  const { token } = useAuth()
  const scheduledState = useSmsScheduledState(module.templates)
  const [sendMode, setSendMode] = useState<'immediate' | 'reserved'>(initialSendMode)

  const {
    busy,
    settings,
    verifiedSenders,
    templates,
    bulkForm,
    setBulkForm,
    preview,
    previewAcknowledged,
    handlePreviewBulk,
    handleCreateBulk,
    handleLoadTemplateToSend,
  } = module

  const syncCustomerIdsText = useCallback(
    (customerIdsText: string) => {
      setBulkForm((prev) => ({ ...prev, customerIdsText }))
    },
    [setBulkForm],
  )

  const {
    selectedGroupId,
    setSelectedGroupId,
    selectedGroup,
    groupSummary,
    isLoadingGroupMembers,
    handleGroupChange,
  } = useSmsSendGroupSelection({
    token,
    groups: scheduledState.groups,
    onCustomerIdsTextChange: syncCustomerIdsText,
  })

  const realSendEnabledFlag = Boolean(settings?.realSendEnabled)

  useEffect(() => {
    setSendMode(initialSendMode)
  }, [initialSendMode])

  const messageBody = sendMode === 'reserved' ? scheduledState.form.messageBody : bulkForm.message
  const messageType = sendMode === 'reserved' ? scheduledState.form.messageType : bulkForm.messageType

  const { meta } = useSmsMessageComposeMeta({
    body: messageBody,
    isAdvertisement: messageType === 'ad',
    adDisplayName,
    previewSubstitution: { mode: 'preserve' },
  })

  const handleMessageChange = (message: string) => {
    if (sendMode === 'reserved') {
      scheduledState.updateForm({ messageBody: message })
      return
    }
    setBulkForm((prev) => ({ ...prev, message }))
  }

  const handleAdChange = (checked: boolean) => {
    const nextType = checked ? 'ad' : 'info'
    if (sendMode === 'reserved') {
      scheduledState.updateForm({ messageType: nextType })
      return
    }
    setBulkForm((prev) => ({ ...prev, messageType: nextType }))
  }

  const handleTemplateSelect = (templateId: string) => {
    if (!templateId) {
      return
    }
    const template = templates.find((row) => String(row.id) === templateId)
    if (template) {
      handleLoadTemplateToSend(template)
      if (sendMode === 'reserved') {
        scheduledState.updateForm({
          templateId,
          messageBody: template.message,
          messageType: template.messageType,
        })
      }
    }
  }

  const handleSaveReserved = () => {
    scheduledState.updateForm({
      messageBody: bulkForm.message || scheduledState.form.messageBody,
      messageType: bulkForm.messageType,
      recipientGroupId: selectedGroupId,
    })
    scheduledState.saveRule()
  }

  const handleEditReservedRule = (ruleId: string) => {
    const rule = scheduledState.rules.find((row) => row.id === ruleId)
    setSendMode('reserved')
    scheduledState.selectRule(ruleId)
    setSelectedGroupId(rule?.recipientGroupId ?? '')
  }

  const handleDeleteReservedRule = (rule: SmsScheduledRule) => {
    scheduledState.deleteRuleById(rule.id)
  }

  const layout = variant === 'pc' ? 'sms-send-workspace--pc' : 'sms-send-workspace--mobile'

  return (
    <div className={`sms-send-workspace ${layout}`}>
      {scheduledState.actionNotice ? <p className="sms-module__muted">{scheduledState.actionNotice}</p> : null}

      <div className="sms-send-workspace__mode-row">
        <span className="sms-send-section__label">발송 방식</span>
        <SendModeSelector value={sendMode} disabled={busy} onChange={setSendMode} />
      </div>

      <div className="sms-send-workspace__main">
        <aside className="sms-send-workspace__left">
          <section className="sms-send-section">
            <h3 className="sms-send-section__title">대상 그룹</h3>
            <label>
              그룹 선택
              <select
                className="sms-module__select"
                value={selectedGroupId}
                disabled={busy || isLoadingGroupMembers}
                onChange={(e) => handleGroupChange(e.target.value)}
              >
                <option value="">그룹 선택</option>
                {scheduledState.groups.map((group) => (
                  <option key={group.id} value={String(group.id)}>
                    {group.name} ({group.recipientCount}명)
                  </option>
                ))}
              </select>
            </label>
            {selectedGroup && groupSummary ? (
              <div className="sms-send-group-summary">
                <p>{selectedGroup.name}</p>
                <p className="sms-module__muted">
                  총 {groupSummary.total}명 · 발송 가능 {groupSummary.sendable}명 · 제외 {groupSummary.excluded}명
                </p>
              </div>
            ) : null}
          </section>

          {sendMode === 'reserved' ? (
            <section className="sms-send-section">
              <h3 className="sms-send-section__title">예약 조건</h3>
              <ReservedScheduleFields form={scheduledState.form} updateForm={scheduledState.updateForm} disabled={busy} />
            </section>
          ) : null}

          <section className="sms-send-section">
            <h3 className="sms-send-section__title">템플릿</h3>
            <label>
              템플릿 불러오기
              <select
                className="sms-module__select"
                value={sendMode === 'reserved' ? scheduledState.form.templateId : ''}
                disabled={busy}
                onChange={(e) => handleTemplateSelect(e.target.value)}
              >
                <option value="">템플릿 선택</option>
                {templates.map((template: SmsTemplate) => (
                  <option key={template.id} value={String(template.id)}>
                    {template.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="sms-send-template-actions">
              <FormButton type="button" variant="secondary" disabled={busy} onClick={() => navigate('/sms/templates')}>
                템플릿 관리
              </FormButton>
            </div>
          </section>
        </aside>

        <div className="sms-send-workspace__center">
          <SmsComposerLayout
            variant={variant}
            showPreview={variant === 'mobile'}
            message={messageBody}
            onMessageChange={handleMessageChange}
            isAdvertisement={messageType === 'ad'}
            onAdvertisementChange={handleAdChange}
            senderNumber={bulkForm.senderNumber || settings?.defaultSender}
            adDisplayName={adDisplayName}
            previewSubstitution={{ mode: 'preserve' }}
            realSendEnabled={realSendEnabledFlag}
            disabled={busy}
            setupFields={
              sendMode === 'immediate' ? (
                <div className="sms-module__grid">
                  <label>
                    발송 제목
                    <FormInput
                      value={bulkForm.title}
                      onChange={(e) => setBulkForm((prev) => ({ ...prev, title: e.target.value }))}
                    />
                  </label>
                  <label>
                    발신번호
                    <select
                      className="sms-module__select"
                      value={bulkForm.senderNumber}
                      onChange={(e) => setBulkForm((prev) => ({ ...prev, senderNumber: e.target.value }))}
                    >
                      <option value="">선택</option>
                      {verifiedSenders.map((s) => (
                        <option key={s.id} value={s.senderNumber}>
                          {formatKrMobileDisplay(s.senderNumber)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
                <p className="sms-module__muted">예약 발송은 그룹과 예약 조건을 확인한 뒤 저장합니다.</p>
              )
            }
            actions={
              sendMode === 'immediate' ? (
                <div className="sms-module__actions">
                  <FormButton type="button" variant="secondary" disabled={busy} onClick={() => void handlePreviewBulk()}>
                    발송 미리보기
                  </FormButton>
                  <FormButton
                    type="button"
                    disabled={busy || !previewAcknowledged || !realSendEnabledFlag}
                    onClick={() => void handleCreateBulk(false)}
                  >
                    발송 준비
                  </FormButton>
                  {!realSendEnabledFlag ? (
                    <p className="sms-composer__send-disabled-note">
                      실발송 비활성 상태입니다. 현재는 미리보기/저장만 가능합니다.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="sms-module__actions">
                  <FormButton type="button" disabled={busy || !scheduledState.canSave} onClick={handleSaveReserved}>
                    예약 저장
                  </FormButton>
                  {!realSendEnabledFlag ? (
                    <p className="sms-composer__send-disabled-note">
                      실발송 비활성 상태입니다. 예약 규칙은 localStorage에 저장됩니다.
                    </p>
                  ) : null}
                </div>
              )
            }
            below={
              preview && sendMode === 'immediate' ? (
                <div className="sms-module__preview sms-composer__campaign-preview">
                  <p>
                    발송 가능 {preview.sendableCount}건 / 제외 {preview.skippedCount}건
                  </p>
                </div>
              ) : null
            }
          />
        </div>

        {variant === 'pc' ? (
          <aside className="sms-send-workspace__right sms-send-preview-panel">
            <SmsPhonePreview meta={meta} senderNumber={settings?.defaultSender} hideCaption />
            {selectedGroup && groupSummary ? (
              <div className="sms-send-target-summary">
                <h3 className="sms-send-section__title">대상 요약</h3>
                <p>{selectedGroup.name}</p>
                <p className="sms-module__muted">
                  발송 가능 {groupSummary.sendable}명 · 제외 {groupSummary.excluded}명
                </p>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>

      <ReservedRulesSection
        rules={scheduledState.rules}
        groups={scheduledState.groups}
        disabled={busy}
        onEdit={handleEditReservedRule}
        onCopy={scheduledState.copyRule}
        onDelete={handleDeleteReservedRule}
      />

      {scheduledState.confirmDialog}
    </div>
  )
}
