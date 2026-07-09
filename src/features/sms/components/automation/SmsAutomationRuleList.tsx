import FormButton from '../../../../components/form/FormButton'
import {
  formatAutomationDayOffsetLabel,
  formatAutomationUpdatedAt,
  labelForAutomationTriggerType,
} from '../../config/smsAutomationRule.config'
import type { SmsAutomationRule } from '../../types/smsAutomationRuleTypes'

export type SmsAutomationRuleListProps = {
  rules: SmsAutomationRule[]
  selectedRuleId: number | null
  loading: boolean
  onSelect: (ruleId: number) => void
  onCreate: () => void
}

export function SmsAutomationRuleList({
  rules,
  selectedRuleId,
  loading,
  onSelect,
  onCreate,
}: SmsAutomationRuleListProps) {
  return (
    <section className="sms-automation-rules__list-panel" aria-label="자동문자 규칙 목록">
      <div className="sms-automation-rules__list-header">
        <h2 className="sms-automation-rules__panel-title">규칙 목록</h2>
        <FormButton htmlType="button" variant="primary" onClick={onCreate}>
          규칙 추가
        </FormButton>
      </div>
      {loading ? (
        <p className="sms-automation-rules__muted">불러오는 중…</p>
      ) : rules.length === 0 ? (
        <p className="sms-automation-rules__empty">등록된 자동문자 규칙이 없습니다.</p>
      ) : (
        <ul className="sms-automation-rules__list">
          {rules.map((rule) => {
            const active = selectedRuleId === rule.id
            return (
              <li key={rule.id}>
                <button
                  type="button"
                  className={`sms-automation-rules__list-item${active ? ' sms-automation-rules__list-item--active' : ''}`}
                  onClick={() => onSelect(rule.id)}
                >
                  <span className="sms-automation-rules__list-item-name">{rule.ruleName}</span>
                  <span className="sms-automation-rules__list-item-meta">
                    {labelForAutomationTriggerType(rule.triggerType)} ·{' '}
                    {formatAutomationDayOffsetLabel(rule.dayOffset)} · {rule.sendTime}
                  </span>
                  <span className="sms-automation-rules__list-item-meta">
                    {rule.isActive ? '사용' : '중지'} · 수정{' '}
                    {formatAutomationUpdatedAt(rule.updatedAt)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
