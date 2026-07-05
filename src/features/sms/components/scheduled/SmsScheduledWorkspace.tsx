import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import { SMS_SCHEDULE_LIST_FILTER_OPTIONS, SMS_SCHEDULE_MOBILE_PANELS, SMS_SCHEDULE_MONTH_DAY_MAX, SMS_SCHEDULE_MONTH_DAY_MIN, SMS_SCHEDULE_TARGET_PREVIEW_LIMIT, SMS_SCHEDULE_TYPE_OPTIONS, SMS_SCHEDULE_WEEKDAY_OPTIONS } from '../../config/smsScheduled.config'
import { useSmsMessageComposeMeta } from '../../hooks/useSmsMessageComposeMeta'
import { useSmsScheduledState } from '../../hooks/useSmsScheduledState'
import type { SmsTemplate } from '../../types/sms.types'
import type { SmsScheduledRule } from '../../types/smsScheduled.types'
import { buildScheduleListCardMeta, buildScheduleSummary, formatNextRunAtLabel } from '../../utils/smsScheduledSummary'
import SmsMessageEditor from '../composer/SmsMessageEditor'
import SmsPhonePreview from '../composer/SmsPhonePreview'

type Props = {
  variant: 'pc' | 'mobile'
  disabled?: boolean
  templates: SmsTemplate[]
  realSendEnabled: boolean
  defaultSender?: string
  adDisplayName: string
}

function ScheduleTypeSelector({
  value,
  onChange,
  disabled,
}: {
  value: SmsScheduledRule['scheduleType']
  onChange: (value: SmsScheduledRule['scheduleType']) => void
  disabled?: boolean
}) {
  return (
    <div className="sms-scheduled-segment" role="radiogroup" aria-label="예약 주기">
      {SMS_SCHEDULE_TYPE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`sms-scheduled-segment__btn${value === option.value ? ' sms-scheduled-segment__btn--active' : ''}`}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function WeekdaySelector({
  value,
  onChange,
  disabled,
}: {
  value: number[]
  onChange: (value: number[]) => void
  disabled?: boolean
}) {
  const toggle = (day: number) => {
    if (value.includes(day)) {
      onChange(value.filter((row) => row !== day))
      return
    }
    onChange([...value, day])
  }

  return (
    <div className="sms-scheduled-weekdays">
      {SMS_SCHEDULE_WEEKDAY_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`sms-scheduled-weekday${value.includes(option.value) ? ' sms-scheduled-weekday--active' : ''}`}
          disabled={disabled}
          onClick={() => toggle(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function ScheduledListPanel({
  state,
  disabled,
}: {
  state: ReturnType<typeof useSmsScheduledState>
  disabled?: boolean
}) {
  const { filteredRules, listFilter, setListFilter, listSearch, setListSearch, selectedRuleId, startCreate, selectRule } =
    state

  return (
    <section className="sms-scheduled-panel sms-scheduled-panel--list">
      <div className="sms-scheduled-panel__header">
        <h2 className="sms-scheduled-panel__title">예약문자</h2>
        <FormButton type="button" disabled={disabled} onClick={startCreate}>
          + 새 예약문자
        </FormButton>
      </div>

      <div className="sms-scheduled-list-filters">
        {SMS_SCHEDULE_LIST_FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`sms-scheduled-list-filters__btn${listFilter === option.value ? ' sms-scheduled-list-filters__btn--active' : ''}`}
            onClick={() => setListFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="sms-scheduled-search">
        <span className="sms-scheduled-search__label">예약명 검색</span>
        <FormInput
          value={listSearch}
          disabled={disabled}
          placeholder="예약명 검색"
          onChange={(e) => setListSearch(e.target.value)}
        />
      </label>

      {filteredRules.length === 0 ? (
        <div className="sms-scheduled-empty">
          <p>아직 등록된 예약문자가 없습니다.</p>
          <p className="sms-module__muted">
            자주 보내는 안내 문자를 예약해 두면 정해진 시간에 자동으로 발송할 수 있습니다.
          </p>
          <FormButton type="button" disabled={disabled} onClick={startCreate}>
            + 새 예약문자 만들기
          </FormButton>
        </div>
      ) : (
        <ul className="sms-scheduled-list">
          {filteredRules.map((rule) => (
            <li key={rule.id}>
              <button
                type="button"
                className={`sms-scheduled-card${selectedRuleId === rule.id ? ' sms-scheduled-card--active' : ''}`}
                onClick={() => selectRule(rule.id)}
              >
                <p className="sms-scheduled-card__name">{rule.name}</p>
                <p className="sms-scheduled-card__meta">{buildScheduleListCardMeta(rule)}</p>
                <p className="sms-scheduled-card__group">그룹: {state.groups.find((g) => String(g.id) === rule.recipientGroupId)?.name ?? '미지정'}</p>
                <p className="sms-scheduled-card__next">다음 실행: {formatNextRunAtLabel(rule.nextRunAt)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ScheduledFormPanel({
  state,
  templates,
  adDisplayName,
  disabled,
}: {
  state: ReturnType<typeof useSmsScheduledState>
  templates: SmsTemplate[]
  adDisplayName: string
  disabled?: boolean
}) {
  const {
    showEditor,
    form,
    updateForm,
    applyTemplate,
    selectedRule,
    validation,
    canSave,
    selectedGroup,
    memberSummary,
    membersBusy,
    cancelEdit,
    refreshPreview,
    saveRule,
    disableRule,
    deleteRule,
  } = state

  const { meta, transitionNotice, dismissTransitionNotice } = useSmsMessageComposeMeta({
    body: form.messageBody,
    isAdvertisement: form.messageType === 'ad',
    adDisplayName,
    previewSubstitution: { mode: 'preserve' },
  })

  if (!showEditor) {
    return (
      <section className="sms-scheduled-panel sms-scheduled-panel--form sms-scheduled-panel--placeholder">
        <p className="sms-module__muted">왼쪽에서 예약문자를 선택하거나 새 예약문자를 만들어 주세요.</p>
      </section>
    )
  }

  return (
    <section className="sms-scheduled-panel sms-scheduled-panel--form">
      <h2 className="sms-scheduled-panel__title">{selectedRule ? '예약문자 수정' : '새 예약문자'}</h2>

      <div className="sms-scheduled-form">
        <label>
          예약명
          <FormInput
            value={form.name}
            disabled={disabled}
            placeholder="예: 생일 축하 문자, 보험 만기 안내, 상령일 안내"
            onChange={(e) => updateForm({ name: e.target.value })}
          />
        </label>

        <label className="sms-scheduled-toggle">
          <input
            type="checkbox"
            checked={form.enabled}
            disabled={disabled}
            onChange={(e) => updateForm({ enabled: e.target.checked })}
          />
          <span>사용 여부</span>
        </label>

        <label>
          예약 설명
          <FormInput
            value={form.description}
            disabled={disabled}
            placeholder="선택 입력"
            onChange={(e) => updateForm({ description: e.target.value })}
          />
        </label>

        <div className="sms-scheduled-form__block">
          <span className="sms-scheduled-form__label">예약 주기</span>
          <ScheduleTypeSelector
            value={form.scheduleType}
            disabled={disabled}
            onChange={(scheduleType) => updateForm({ scheduleType })}
          />
        </div>

        {form.scheduleType === 'once' ? (
          <label>
            발송 날짜
            <FormInput
              type="date"
              value={form.sendDate}
              disabled={disabled}
              onChange={(e) => updateForm({ sendDate: e.target.value })}
            />
          </label>
        ) : null}

        {form.scheduleType === 'weekly' ? (
          <div className="sms-scheduled-form__block">
            <span className="sms-scheduled-form__label">요일 선택</span>
            <WeekdaySelector
              value={form.weekdays}
              disabled={disabled}
              onChange={(weekdays) => updateForm({ weekdays })}
            />
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
            <p className="sms-scheduled-form__hint">
              선택한 날짜가 없는 달에는 해당 월 마지막 날에 발송됩니다.
            </p>
          </>
        ) : null}

        <label>
          발송 시간
          <FormInput
            type="time"
            value={form.sendTime}
            disabled={disabled}
            onChange={(e) => updateForm({ sendTime: e.target.value })}
          />
        </label>
        <p className="sms-scheduled-form__hint">발송 시간은 한국 시간 기준입니다.</p>

        <label>
          연락처 그룹
          <select
            className="sms-module__select"
            value={form.recipientGroupId}
            disabled={disabled}
            onChange={(e) => updateForm({ recipientGroupId: e.target.value })}
          >
            <option value="">그룹 선택</option>
            {state.groups.map((group) => (
              <option key={group.id} value={String(group.id)}>
                {group.name}
              </option>
            ))}
          </select>
        </label>

        {selectedGroup ? (
          <div className="sms-scheduled-group-summary">
            <p className="sms-scheduled-group-summary__name">{selectedGroup.name}</p>
            <p className="sms-scheduled-group-summary__counts">
              총 {memberSummary.total}명 · 발송 가능 {memberSummary.sendable}명 · 제외 {memberSummary.excluded}명
            </p>
            {membersBusy ? <p className="sms-module__muted">그룹 구성원을 불러오는 중…</p> : null}
          </div>
        ) : null}

        <label>
          템플릿 불러오기
          <select
            className="sms-module__select"
            value={form.templateId}
            disabled={disabled}
            onChange={(e) => applyTemplate(e.target.value)}
          >
            <option value="">템플릿 선택</option>
            {templates.map((template) => (
              <option key={template.id} value={String(template.id)}>
                {template.title}
              </option>
            ))}
          </select>
        </label>

        <SmsMessageEditor
          message={form.messageBody}
          onMessageChange={(messageBody) => updateForm({ messageBody })}
          meta={meta}
          isAdvertisement={form.messageType === 'ad'}
          onAdvertisementChange={(checked) => updateForm({ messageType: checked ? 'ad' : 'info' })}
          attachment={null}
          realSendEnabled={false}
          transitionNotice={transitionNotice}
          onDismissTransition={dismissTransitionNotice}
          disabled={disabled}
        />

        {!canSave && validation.missing.length > 0 ? (
          <p className="sms-scheduled-form__validation">필수 입력: {validation.missing.join(', ')}</p>
        ) : null}

        <div className="sms-scheduled-form__actions">
          <FormButton type="button" variant="secondary" disabled={disabled} onClick={cancelEdit}>
            취소
          </FormButton>
          <FormButton type="button" variant="secondary" disabled={disabled} onClick={refreshPreview}>
            미리보기 갱신
          </FormButton>
          <FormButton type="button" disabled={disabled || !canSave} onClick={saveRule}>
            저장
          </FormButton>
          {selectedRule ? (
            <>
              <FormButton type="button" variant="secondary" disabled={disabled} onClick={disableRule}>
                비활성화
              </FormButton>
              <FormButton type="button" variant="secondary" disabled={disabled} onClick={() => void deleteRule()}>
                삭제
              </FormButton>
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function ScheduledPreviewPanel({
  state,
  defaultSender,
  adDisplayName,
  realSendEnabled,
}: {
  state: ReturnType<typeof useSmsScheduledState>
  defaultSender?: string
  adDisplayName: string
  realSendEnabled: boolean
}) {
  const { form, selectedGroup, memberSummary, previewSample, groupMembers, scheduleSummaryNextRun } = state
  const previewSubstitution = previewSample
    ? {
        mode: 'selectedCustomer' as const,
        selectedCustomerName: previewSample.name,
        values: { customerName: previewSample.name },
      }
    : { mode: 'preserve' as const }

  const { meta } = useSmsMessageComposeMeta({
    body: form.messageBody,
    isAdvertisement: form.messageType === 'ad',
    adDisplayName,
    previewSubstitution,
  })

  const visibleMembers = groupMembers.slice(0, SMS_SCHEDULE_TARGET_PREVIEW_LIMIT)
  const hiddenCount = Math.max(0, groupMembers.length - visibleMembers.length)

  return (
    <div className="sms-scheduled-panel sms-scheduled-panel--preview-stack">
      <section className="sms-scheduled-preview-block">
        <h3 className="sms-scheduled-preview-block__title">예약 요약</h3>
        <ul className="sms-scheduled-preview-block__list">
          <li>{buildScheduleSummary(form)}</li>
          <li>대상 그룹: {selectedGroup?.name ?? '미선택'}</li>
          <li>예상 대상: {memberSummary.sendable}명</li>
          <li>다음 실행: {scheduleSummaryNextRun}</li>
        </ul>
      </section>

      <section className="sms-scheduled-preview-block">
        <h3 className="sms-scheduled-preview-block__title">휴대폰 미리보기</h3>
        {form.name ? <p className="sms-scheduled-preview-block__subtitle">{form.name}</p> : null}
        <p className="sms-scheduled-preview-block__subtitle">{buildScheduleSummary(form)}</p>
        {previewSample ? (
          <p className="sms-module__muted">
            {previewSample.name} 고객 기준 미리보기 · {previewSample.phoneDisplay || '연락처 없음'}
          </p>
        ) : null}
        <SmsPhonePreview meta={meta} senderNumber={defaultSender} />
      </section>

      <section className="sms-scheduled-preview-block">
        <h3 className="sms-scheduled-preview-block__title">예상 대상</h3>
        {groupMembers.length === 0 ? (
          <p className="sms-module__muted">연락처 그룹을 선택하면 대상 목록이 표시됩니다.</p>
        ) : (
          <ul className="sms-scheduled-target-list">
            {visibleMembers.map((row) => (
              <li key={row.customerId}>
                {row.name} · {row.phoneDisplay || '연락처 없음'} ·{' '}
                {row.canSend ? '발송 가능' : state.formatBlockedReason(row.blockedReason)}
              </li>
            ))}
          </ul>
        )}
        {hiddenCount > 0 ? <p className="sms-module__muted">외 {hiddenCount}명</p> : null}
      </section>

      <section className="sms-scheduled-preview-block">
        <h3 className="sms-scheduled-preview-block__title">최근 실행 이력</h3>
        {state.runHistory.length === 0 ? (
          <p className="sms-module__muted">
            {realSendEnabled
              ? '아직 실행 이력이 없습니다.'
              : '실발송 비활성 상태라 실제 발송 이력은 생성되지 않습니다.'}
          </p>
        ) : (
          <ul className="sms-scheduled-history-list">
            {state.runHistory.map((row) => (
              <li key={row.id}>
                {new Date(row.ranAt).toLocaleString('ko-KR', { hour12: false })}
                <br />
                대상 {row.targetCount}명 · 성공 {row.successCount} · 제외 {row.skippedCount}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default function SmsScheduledWorkspace({
  variant,
  disabled = false,
  templates,
  realSendEnabled,
  defaultSender,
  adDisplayName,
}: Props) {
  const state = useSmsScheduledState(templates)
  const { confirmDialog, actionNotice, mobilePanel, setMobilePanel, showEditor, saveRule, canSave } = state

  if (variant === 'pc') {
    return (
      <div className="sms-scheduled-workspace sms-scheduled-workspace--pc">
        {actionNotice ? <p className="sms-scheduled-workspace__notice">{actionNotice}</p> : null}
        <ScheduledListPanel state={state} disabled={disabled} />
        <ScheduledFormPanel state={state} templates={templates} adDisplayName={adDisplayName} disabled={disabled} />
        <ScheduledPreviewPanel
          state={state}
          defaultSender={defaultSender}
          adDisplayName={adDisplayName}
          realSendEnabled={realSendEnabled}
        />
        {confirmDialog}
      </div>
    )
  }

  return (
    <div className="sms-scheduled-workspace sms-scheduled-workspace--mobile">
      {actionNotice ? <p className="sms-scheduled-workspace__notice">{actionNotice}</p> : null}
      <div className="sms-scheduled-mobile-tabs">
        {SMS_SCHEDULE_MOBILE_PANELS.map((panel) => (
          <button
            key={panel.id}
            type="button"
            className={`sms-scheduled-mobile-tabs__btn${mobilePanel === panel.id ? ' sms-scheduled-mobile-tabs__btn--active' : ''}`}
            onClick={() => setMobilePanel(panel.id)}
          >
            {panel.label}
          </button>
        ))}
      </div>

      {mobilePanel === 'list' ? <ScheduledListPanel state={state} disabled={disabled} /> : null}
      {mobilePanel === 'settings' ? (
        <ScheduledFormPanel state={state} templates={templates} adDisplayName={adDisplayName} disabled={disabled} />
      ) : null}
      {mobilePanel === 'preview' ? (
        <ScheduledPreviewPanel
          state={state}
          defaultSender={defaultSender}
          adDisplayName={adDisplayName}
          realSendEnabled={realSendEnabled}
        />
      ) : null}
      {mobilePanel === 'history' ? (
        <section className="sms-scheduled-panel sms-scheduled-panel--history">
          <h2 className="sms-scheduled-panel__title">최근 실행 이력</h2>
          <p className="sms-module__muted">
            {realSendEnabled
              ? '아직 실행 이력이 없습니다.'
              : '실발송 비활성 상태라 실제 발송 이력은 생성되지 않습니다.'}
          </p>
        </section>
      ) : null}

      {showEditor && mobilePanel === 'settings' ? (
        <div className="sms-scheduled-mobile-save-bar">
          <FormButton type="button" disabled={disabled || !canSave} onClick={saveRule}>
            저장
          </FormButton>
        </div>
      ) : null}

      {confirmDialog}
    </div>
  )
}
