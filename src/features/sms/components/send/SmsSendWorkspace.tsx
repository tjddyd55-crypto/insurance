import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import AppDateInput from '../../../../components/common/AppDateInput'
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
import { validateSmsScheduledSave } from '../../utils/smsScheduledValidation'
import { computeNextRunAtPreview } from '../../utils/smsScheduledSummary'
import { buildReservationPreviewSubstitution } from '../../utils/smsReservationPreviewSubstitution'
import { formatKrMobileDisplay } from '../../smsDisplayUtils'
import SmsComposerLayout from '../composer/SmsComposerLayout'
import SmsPhonePreview from '../composer/SmsPhonePreview'
import { SmsReservedRulesList } from './SmsReservedRulesList'

type Props = {
  variant: 'pc' | 'mobile'
  module: SmsModuleViewProps
  initialSendMode: 'immediate' | 'reserved'
  lockSendMode?: boolean
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
          <AppDateInput value={form.sendDate} disabled={disabled} onChange={(sendDate) => updateForm({ sendDate })} />
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

function GroupSelectionSection({
  selectedGroupId,
  groups,
  selectedGroup,
  groupSummary,
  busy,
  isLoadingGroupMembers,
  onGroupChange,
}: {
  selectedGroupId: string
  groups: { id: number; name: string; recipientCount: number }[]
  selectedGroup: { id: number; name: string } | null | undefined
  groupSummary: { total: number; sendable: number; excluded: number } | null | undefined
  busy?: boolean
  isLoadingGroupMembers?: boolean
  onGroupChange: (groupId: string) => void
}) {
  return (
    <section className="sms-send-section">
      <h3 className="sms-send-section__title">그룹 설정</h3>
      <label>
        연락처 그룹
        <select
          className="sms-module__select"
          value={selectedGroupId}
          disabled={busy || isLoadingGroupMembers}
          onChange={(e) => onGroupChange(e.target.value)}
        >
          <option value="">그룹 선택</option>
          {groups.map((group) => (
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
  )
}

function TemplateSelectionSection({
  templates,
  templateId,
  busy,
  onTemplateSelect,
  onManageTemplates,
}: {
  templates: SmsTemplate[]
  templateId: string
  busy?: boolean
  onTemplateSelect: (templateId: string) => void
  onManageTemplates: () => void
}) {
  return (
    <section className="sms-send-section">
      <h3 className="sms-send-section__title">템플릿 선택</h3>
      <label>
        템플릿 불러오기
        <select
          className="sms-module__select"
          value={templateId}
          disabled={busy}
          onChange={(e) => onTemplateSelect(e.target.value)}
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
        <FormButton type="button" variant="secondary" disabled={busy} onClick={onManageTemplates}>
          템플릿 관리
        </FormButton>
      </div>
    </section>
  )
}

export default function SmsSendWorkspace({
  variant,
  module,
  initialSendMode,
  lockSendMode = false,
  adDisplayName,
}: Props) {
  const navigate = useNavigate()
  const { token } = useAuth()
  const scheduledState = useSmsScheduledState(module.templates)
  const [sendMode, setSendMode] = useState<'immediate' | 'reserved'>(initialSendMode)

  useEffect(() => {
    setSendMode(initialSendMode)
  }, [initialSendMode])

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

  const { user } = useAuth()

  const {
    selectedGroupId,
    setSelectedGroupId,
    selectedGroup,
    groupSummary,
    previewMember,
    isLoadingGroupMembers,
    handleGroupChange,
  } = useSmsSendGroupSelection({
    token,
    groups: scheduledState.groups,
    onCustomerIdsTextChange: syncCustomerIdsText,
  })

  const realSendEnabledFlag = Boolean(settings?.realSendEnabled)

  const messageBody = sendMode === 'reserved' ? scheduledState.form.messageBody : bulkForm.message
  const messageType = sendMode === 'reserved' ? scheduledState.form.messageType : bulkForm.messageType

  const reservationReferenceDate = useMemo(() => {
    if (sendMode !== 'reserved') {
      return undefined
    }
    const nextRunAt = computeNextRunAtPreview({ ...scheduledState.form, enabled: true })
    if (nextRunAt) {
      return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(nextRunAt))
    }
    return scheduledState.form.sendDate?.trim() || undefined
  }, [sendMode, scheduledState.form])

  const previewSubstitution = useMemo(
    () =>
      buildReservationPreviewSubstitution({
        customerName: previewMember?.name,
        agentName: user?.displayName,
        referenceDate: reservationReferenceDate,
        dDayLabel: '당일',
      }),
    [previewMember?.name, user?.displayName, reservationReferenceDate],
  )

  const { meta } = useSmsMessageComposeMeta({
    body: messageBody,
    isAdvertisement: messageType === 'ad',
    adDisplayName,
    previewSubstitution,
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

  const handleGroupChangeForSend = useCallback(
    (groupId: string) => {
      handleGroupChange(groupId)
      scheduledState.updateForm({ recipientGroupId: groupId })
    },
    [handleGroupChange, scheduledState],
  )

  const scheduleSaveValidation = useMemo(
    () =>
      validateSmsScheduledSave({
        form: scheduledState.form,
        recipientGroupId: selectedGroupId,
        sendableCount: groupSummary?.sendable ?? null,
        groupMembersLoading: isLoadingGroupMembers,
        smsModuleEnabled: settings?.moduleEnabled !== false,
      }),
    [
      scheduledState.form,
      selectedGroupId,
      groupSummary?.sendable,
      isLoadingGroupMembers,
      settings?.moduleEnabled,
    ],
  )

  const handleSaveReserved = () => {
    scheduledState.saveRule({
      recipientGroupId: selectedGroupId,
      messageBody: scheduledState.form.messageBody,
      messageType: scheduledState.form.messageType,
    })
  }

  const handleEditReservedRule = (ruleId: string) => {
    const rule = scheduledState.rules.find((row) => row.id === ruleId)
    setSendMode('reserved')
    scheduledState.selectRule(ruleId)
    setSelectedGroupId(rule?.recipientGroupId ?? '')
  }

  const handleSelectReservedRule = (ruleId: string) => {
    handleEditReservedRule(ruleId)
  }

  const handleDeleteReservedRule = (rule: SmsScheduledRule) => {
    void scheduledState.deleteRuleById(rule.id)
  }

  const layout = variant === 'pc' ? 'sms-send-workspace--pc' : 'sms-send-workspace--mobile'
  const isReservedPc = sendMode === 'reserved' && variant === 'pc'

  const composerNode = (
    <SmsComposerLayout
      variant={variant}
      showPreview={variant === 'mobile'}
      message={messageBody}
      onMessageChange={handleMessageChange}
      isAdvertisement={messageType === 'ad'}
      onAdvertisementChange={handleAdChange}
      senderNumber={bulkForm.senderNumber || settings?.defaultSender}
      adDisplayName={adDisplayName}
      previewSubstitution={previewSubstitution}
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
        ) : null
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
            <FormButton
              type="button"
              disabled={busy || !scheduleSaveValidation.canSave}
              onClick={handleSaveReserved}
            >
              예약 저장
            </FormButton>
            {scheduleSaveValidation.disabledReason ? (
              <p className="sms-send-workspace__validation-message">{scheduleSaveValidation.disabledReason}</p>
            ) : null}
            {!realSendEnabledFlag ? (
              <p className="sms-composer__send-disabled-note">
                실발송 비활성 상태입니다. 예약은 서버에 저장되지만 예약 시간에 실제 발송되지 않습니다.
              </p>
            ) : (
              <p className="sms-composer__send-disabled-note">
                예약 저장 시 서버에 등록되며, 예약 시간에 자동 발송됩니다.
              </p>
            )}
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
  )

  const phonePreviewAside =
    variant === 'pc' ? (
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
    ) : null

  const reservedListNode = (
    <SmsReservedRulesList
      rules={scheduledState.rules}
      groups={scheduledState.groups}
      selectedRuleId={scheduledState.selectedRuleId}
      disabled={busy}
      onSelect={handleSelectReservedRule}
      onEdit={handleEditReservedRule}
      onCopy={scheduledState.copyRule}
      onDelete={handleDeleteReservedRule}
    />
  )

  const reservedComposerNode = (
    <SmsComposerLayout
      variant={variant}
      showPreview={variant === 'mobile'}
      message={messageBody}
      onMessageChange={handleMessageChange}
      isAdvertisement={messageType === 'ad'}
      onAdvertisementChange={handleAdChange}
      senderNumber={bulkForm.senderNumber || settings?.defaultSender}
      adDisplayName={adDisplayName}
      previewSubstitution={previewSubstitution}
      realSendEnabled={realSendEnabledFlag}
      disabled={busy}
    />
  )

  const reservedSaveActions = (
    <div className="sms-module__actions sms-send-workspace__reserved-save">
      <FormButton type="button" disabled={busy || !scheduleSaveValidation.canSave} onClick={handleSaveReserved}>
        예약 저장
      </FormButton>
      {scheduleSaveValidation.disabledReason ? (
        <p className="sms-send-workspace__validation-message">{scheduleSaveValidation.disabledReason}</p>
      ) : null}
      {!realSendEnabledFlag ? (
        <p className="sms-composer__send-disabled-note">
          실발송 비활성 상태입니다. 예약은 서버에 저장되지만 예약 시간에 실제 발송되지 않습니다.
        </p>
      ) : (
        <p className="sms-composer__send-disabled-note">
          예약 저장 시 서버에 등록되며, 예약 시간에 자동 발송됩니다.
        </p>
      )}
    </div>
  )

  const composeFlowNode = (
    <>
      <GroupSelectionSection
        selectedGroupId={selectedGroupId}
        groups={scheduledState.groups}
        selectedGroup={selectedGroup}
        groupSummary={groupSummary}
        busy={busy}
        isLoadingGroupMembers={isLoadingGroupMembers}
        onGroupChange={handleGroupChangeForSend}
      />
      <TemplateSelectionSection
        templates={templates}
        templateId={scheduledState.form.templateId}
        busy={busy}
        onTemplateSelect={handleTemplateSelect}
        onManageTemplates={() => navigate('/sms/templates')}
      />
      {reservedComposerNode}
      <section className="sms-send-section sms-send-section--schedule">
        <h3 className="sms-send-section__title">예약 설정</h3>
        <ReservedScheduleFields form={scheduledState.form} updateForm={scheduledState.updateForm} disabled={busy} />
      </section>
      {reservedSaveActions}
    </>
  )

  return (
    <div className={`sms-send-workspace ${layout}${isReservedPc ? ' sms-send-workspace--reserved-pc' : ''}`}>
      {scheduledState.actionNotice ? <p className="sms-module__muted">{scheduledState.actionNotice}</p> : null}

      {lockSendMode ? null : (
        <div className="sms-send-workspace__mode-row">
          <span className="sms-send-section__label">발송 방식</span>
          <SendModeSelector value={sendMode} disabled={busy} onChange={setSendMode} />
        </div>
      )}

      {sendMode === 'reserved' && variant === 'mobile' ? reservedListNode : null}

      <div
        className={`sms-send-workspace__main${
          isReservedPc ? ' sms-send-workspace__main--reserved' : ''
        }`}
      >
        {isReservedPc ? (
          <aside className="sms-send-workspace__reserved-list">{reservedListNode}</aside>
        ) : sendMode !== 'reserved' ? (
          <aside className="sms-send-workspace__left">
            <GroupSelectionSection
              selectedGroupId={selectedGroupId}
              groups={scheduledState.groups}
              selectedGroup={selectedGroup}
              groupSummary={groupSummary}
              busy={busy}
              isLoadingGroupMembers={isLoadingGroupMembers}
              onGroupChange={handleGroupChangeForSend}
            />
            <TemplateSelectionSection
              templates={templates}
              templateId=""
              busy={busy}
              onTemplateSelect={handleTemplateSelect}
              onManageTemplates={() => navigate('/sms/templates')}
            />
          </aside>
        ) : null}

        <div
          className={`sms-send-workspace__center${
            sendMode === 'reserved' ? ' sms-send-workspace__center--reserved-compose' : ''
          }`}
        >
          {sendMode === 'reserved' ? composeFlowNode : composerNode}
        </div>

        {phonePreviewAside}
      </div>

      {scheduledState.confirmDialog}
    </div>
  )
}
