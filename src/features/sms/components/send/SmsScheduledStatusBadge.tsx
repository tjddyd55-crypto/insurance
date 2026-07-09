import type { SmsScheduledRule } from '../../types/smsScheduled.types'

export type SmsScheduledStatusTone = 'active' | 'waiting' | 'inactive' | 'paused' | 'completed' | 'failed'

export type SmsScheduledStatusDisplay = {
  label: string
  tone: SmsScheduledStatusTone
}

export function resolveSmsScheduledStatusDisplay(rule: SmsScheduledRule): SmsScheduledStatusDisplay {
  if (rule.serverStatus === 'completed') {
    return { label: '발송완료', tone: 'completed' }
  }
  if (rule.status === 'failed' || rule.serverStatus === 'failed') {
    return { label: '실패', tone: 'failed' }
  }
  if (rule.status === 'paused' || rule.serverStatus === 'paused') {
    return { label: '중지됨', tone: 'paused' }
  }
  if (rule.enabled && rule.status === 'active') {
    if (rule.nextRunAt) {
      return { label: '예약대기', tone: 'waiting' }
    }
    return { label: '활성화', tone: 'active' }
  }
  return { label: '비활성', tone: 'inactive' }
}

type SmsScheduledStatusBadgeProps = {
  rule: SmsScheduledRule
}

export function SmsScheduledStatusBadge({ rule }: SmsScheduledStatusBadgeProps) {
  const status = resolveSmsScheduledStatusDisplay(rule)
  return (
    <span className={`sms-scheduled-status-badge sms-scheduled-status-badge--${status.tone}`}>
      {status.label}
    </span>
  )
}
