type CustomerSmsOptOutReadBadgeProps = {
  smsOptOut: boolean
}

export function CustomerSmsOptOutReadBadge({ smsOptOut }: CustomerSmsOptOutReadBadgeProps) {
  if (smsOptOut) {
    return <span className="customer-sms-opt-out-read__badge">문자 수신거부</span>
  }
  return <span className="customer-detail-read__info-value">가능</span>
}
