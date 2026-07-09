import { useCallback, useRef } from 'react'
import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import FormSelect from '../../../../components/form/FormSelect'
import FormTextarea from '../../../../components/form/FormTextarea'
import {
  insertAutomationMessageVariable,
  SMS_AUTOMATION_ACTIVE_OPTIONS,
  SMS_AUTOMATION_SPECIAL_DATE_PURPOSE_OPTIONS,
  SMS_AUTOMATION_TRIGGER_TYPE_OPTIONS,
} from '../../config/smsAutomationRule.config'
import type { SmsAutomationRuleFormState } from '../../types/smsAutomationRuleTypes'
import type { SmsAutomationTriggerType } from '../../types/smsAutomationRuleTypes'
import { SmsAutomationStatusBadge } from './SmsAutomationStatusBadge'
import { SmsAutomationVariableButtons } from './SmsAutomationVariableButtons'

export type SmsAutomationRuleEditorProps = {
  form: SmsAutomationRuleFormState
  isCreating: boolean
  saving: boolean
  onChange: (patch: Partial<SmsAutomationRuleFormState>) => void
  onTriggerTypeChange: (triggerType: SmsAutomationTriggerType) => void
  onSave: () => void
  onDelete: () => void
}

type TextSelection = {
  start: number
  end: number
}

export function SmsAutomationRuleEditor({
  form,
  isCreating,
  saving,
  onChange,
  onTriggerTypeChange,
  onSave,
  onDelete,
}: SmsAutomationRuleEditorProps) {
  const showSpecialDateFilter = form.triggerType === 'CUSTOMER_SPECIAL_DATE'
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null)
  const selectionRef = useRef<TextSelection>({ start: 0, end: 0 })

  const syncSelectionFromTextarea = useCallback(() => {
    const textarea = messageTextareaRef.current
    if (!textarea) {
      return
    }
    selectionRef.current = {
      start: textarea.selectionStart ?? 0,
      end: textarea.selectionEnd ?? 0,
    }
  }, [])

  const handleInsertVariable = useCallback(
    (token: string) => {
      const { start, end } = selectionRef.current
      const next = insertAutomationMessageVariable(form.messageBody, token, start, end)
      onChange({ messageBody: next.text })
      requestAnimationFrame(() => {
        const textarea = messageTextareaRef.current
        if (!textarea) {
          return
        }
        textarea.focus()
        textarea.setSelectionRange(next.cursor, next.cursor)
        selectionRef.current = { start: next.cursor, end: next.cursor }
      })
    },
    [form.messageBody, onChange],
  )

  return (
    <section className="sms-automation-rules__editor-panel" aria-label="자동문자 규칙 편집">
      <div className="sms-automation-rules__editor-heading">
        <h2 className="sms-automation-rules__panel-title">
          {isCreating || form.id == null ? '새 자동문자 규칙' : '규칙 상세/수정'}
        </h2>
        {!isCreating && form.id != null ? <SmsAutomationStatusBadge isActive={form.isActive} /> : null}
      </div>

      <div className="sms-automation-rules__form-grid">
        <label className="sms-automation-rules__field">
          <span className="sms-automation-rules__label">규칙명</span>
          <FormInput
            className="sms-automation-rules__control"
            value={form.ruleName}
            onChange={(e) => onChange({ ruleName: e.target.value })}
            placeholder="예: 생일 축하 문자"
          />
        </label>

        <label className="sms-automation-rules__field">
          <span className="sms-automation-rules__label">자동문자 유형</span>
          <FormSelect
            className="sms-automation-rules__control"
            value={form.triggerType}
            options={SMS_AUTOMATION_TRIGGER_TYPE_OPTIONS}
            onChange={(e) => onTriggerTypeChange(e.target.value as SmsAutomationTriggerType)}
          />
        </label>

        {showSpecialDateFilter ? (
          <label className="sms-automation-rules__field">
            <span className="sms-automation-rules__label">기념일 타입 필터</span>
            <FormSelect
              className="sms-automation-rules__control"
              value={form.specialDatePurposeType ?? 'ALL'}
              options={SMS_AUTOMATION_SPECIAL_DATE_PURPOSE_OPTIONS}
              onChange={(e) =>
                onChange({
                  specialDatePurposeType: e.target.value as SmsAutomationRuleFormState['specialDatePurposeType'],
                })
              }
            />
          </label>
        ) : null}

        <label className="sms-automation-rules__field">
          <span className="sms-automation-rules__label">발송 시점 (며칠 전)</span>
          <div className="sms-automation-rules__inline">
            <FormInput
              className="sms-automation-rules__control sms-automation-rules__control--narrow"
              type="number"
              min={0}
              max={366}
              value={String(form.dayOffset)}
              onChange={(e) => onChange({ dayOffset: Number(e.target.value) || 0 })}
            />
            <span className="sms-automation-rules__inline-suffix">일 전 (0 = 당일)</span>
          </div>
        </label>

        <label className="sms-automation-rules__field">
          <span className="sms-automation-rules__label">발송 시간</span>
          <FormInput
            className="sms-automation-rules__control sms-automation-rules__control--narrow"
            type="time"
            value={form.sendTime}
            onChange={(e) => onChange({ sendTime: e.target.value.slice(0, 5) })}
          />
        </label>

        <label className="sms-automation-rules__field">
          <span className="sms-automation-rules__label">자동문자 상태</span>
          <FormSelect
            className="sms-automation-rules__control sms-automation-rules__control--narrow"
            value={form.isActive ? 'true' : 'false'}
            options={SMS_AUTOMATION_ACTIVE_OPTIONS}
            onChange={(e) => onChange({ isActive: e.target.value === 'true' })}
          />
        </label>

        <div className="sms-automation-rules__field sms-automation-rules__field--wide sms-automation-rules__target-scope">
          <span className="sms-automation-rules__label">대상 범위</span>
          <label className="sms-automation-rules__checkbox-field">
            <input
              type="checkbox"
              checked={form.excludeMinors}
              onChange={(e) => onChange({ excludeMinors: e.target.checked })}
            />
            <span>미성년자 제외</span>
          </label>
          <p className="sms-automation-rules__hint">
            체크하면 만 19세 미만 고객은 대상자 미리보기와 자동 발송 대상에서 제외됩니다.
          </p>
        </div>

        <div className="sms-automation-rules__field sms-automation-rules__field--wide">
          <label className="sms-automation-rules__message-field">
            <span className="sms-automation-rules__label">문자 내용</span>
            <FormTextarea
              ref={messageTextareaRef}
              className="sms-automation-rules__control sms-automation-rules__textarea"
              rows={6}
              value={form.messageBody}
              onChange={(e) => {
                onChange({ messageBody: e.target.value })
                selectionRef.current = {
                  start: e.target.selectionStart ?? e.target.value.length,
                  end: e.target.selectionEnd ?? e.target.value.length,
                }
              }}
              onClick={syncSelectionFromTextarea}
              onKeyUp={syncSelectionFromTextarea}
              onSelect={syncSelectionFromTextarea}
            />
          </label>
          <SmsAutomationVariableButtons
            triggerType={form.triggerType}
            onInsert={handleInsertVariable}
          />
        </div>
      </div>

      <div className="sms-automation-rules__actions">
        <FormButton htmlType="button" variant="primary" disabled={saving} onClick={onSave}>
          {saving ? '저장 중…' : '저장'}
        </FormButton>
        {!isCreating && form.id != null ? (
          <FormButton htmlType="button" variant="secondary" disabled={saving} onClick={onDelete}>
            삭제
          </FormButton>
        ) : null}
      </div>
    </section>
  )
}
