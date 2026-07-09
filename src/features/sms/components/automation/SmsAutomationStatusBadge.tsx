import type { SmsAutomationRule } from '../../types/smsAutomationRuleTypes'

type SmsAutomationStatusBadgeProps = {
  isActive: boolean
}

export function SmsAutomationStatusBadge({ isActive }: SmsAutomationStatusBadgeProps) {
  return (
    <span
      className={`sms-automation-rules__status-badge${
        isActive
          ? ' sms-automation-rules__status-badge--active'
          : ' sms-automation-rules__status-badge--inactive'
      }`}
    >
      {isActive ? '가동중' : '중지중'}
    </span>
  )
}

export function SmsAutomationSummaryCards({ rules }: { rules: SmsAutomationRule[] }) {
  const total = rules.length
  const active = rules.filter((rule) => rule.isActive).length
  const inactive = total - active

  return (
    <div className="sms-automation-rules__summary-cards" aria-label="자동문자 규칙 요약">
      <div className="sms-automation-rules__summary-card">
        <span className="sms-automation-rules__summary-label">전체 규칙</span>
        <strong className="sms-automation-rules__summary-value">{total}</strong>
      </div>
      <div className="sms-automation-rules__summary-card sms-automation-rules__summary-card--active">
        <span className="sms-automation-rules__summary-label">가동중</span>
        <strong className="sms-automation-rules__summary-value">{active}</strong>
      </div>
      <div className="sms-automation-rules__summary-card sms-automation-rules__summary-card--inactive">
        <span className="sms-automation-rules__summary-label">중지중</span>
        <strong className="sms-automation-rules__summary-value">{inactive}</strong>
      </div>
    </div>
  )
}
